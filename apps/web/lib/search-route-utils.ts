import { NextRequest, NextResponse } from "next/server"
import { SearchResponseMCP } from "@/types/global"
import { resolveRegistryDependencyTree } from "@/lib/queries.server"
import fetchFileTextContent from "@/lib/utils/fetchFileTextContent"
import { getSearchSupabaseClient, validateSearchApiKey, recordUsage } from "@/lib/search-utils"

export async function handleCommonSearch(
  request: NextRequest,
  options: {
    functionName: string,
    defaultLimit: number,
    additionalBodyFields?: (body: any) => any,
    sortResults?: (results: any[]) => any[],
    includeSimilarity?: boolean,
    promptRuleId?: string
  }
) {
  const supabase = getSearchSupabaseClient()
  const { success, apiKey, userId, error, status } = await validateSearchApiKey(request, supabase)
  if (!success) return NextResponse.json({ error }, { status })

  try {
    const body = await request.json()
    const {
      search,
      match_threshold = 0.33,
      limit = options.defaultLimit,
      skipUsageRecording = false,
    } = body

    if (!search) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    let promptRule: any = null
    if (options.promptRuleId && userId) {
      const { data: promptRuleData } = await supabase
        .from("prompt_rules")
        .select("*")
        .eq("id", options.promptRuleId)
        .eq("user_id", userId)
        .single()
      if (promptRuleData) promptRule = promptRuleData
    }

    const { data: searchResults, error: functionError } = await supabase.functions.invoke(
      options.functionName,
      { body: { search, match_threshold, limit, ...options.additionalBodyFields?.(body) } },
    )

    if (functionError) {
      return NextResponse.json({ error: "Error fetching search results" }, { status: 500 })
    }

    const searchResultsTruncated = searchResults.slice(0, limit)

    const { data: demos, error: demosError } = await supabase
      .from("demos")
      .select(`
        id, name, demo_code, component_id,
        component:components!component_id (
            name, code, user_id, direct_registry_dependencies, demo_direct_registry_dependencies
        )
      `)
      .in("id", searchResultsTruncated.map((result: any) => result.id))

    if (demosError) {
      return NextResponse.json({ error: "Error fetching demos" }, { status: 500 })
    }

    const promises = (demos || []).map(async (demoRaw) => {
      const component = Array.isArray(demoRaw.component) ? demoRaw.component[0] : demoRaw.component
      const { data: demoCode } = await fetchFileTextContent(demoRaw.demo_code)
      const { data: componentCode } = await fetchFileTextContent(component!.code as string)

      const { data: registryDependencies } = await resolveRegistryDependencyTree({
        supabase,
        sourceDependencySlugs: [
          ...component!.direct_registry_dependencies,
          ...component!.demo_direct_registry_dependencies,
        ],
        withDemoDependencies: false,
      })

      const searchResult = searchResultsTruncated.find((r: any) => r.id === demoRaw.id)

      return {
        demoName: demoRaw.name,
        demoCode: demoCode ?? "",
        componentName: component!.name,
        componentCode: componentCode ?? "",
        registryDependencies: registryDependencies || undefined,
        similarity: options.includeSimilarity && searchResult?.usage_data?.total_usages
          ? searchResult.usage_data.total_usages / 1000
          : undefined,
      }
    })

    let demosWithCodeAndRegistryDependencies = await Promise.all(promises)
    if (options.sortResults) {
      demosWithCodeAndRegistryDependencies = options.sortResults(demosWithCodeAndRegistryDependencies)
    }

    if (!skipUsageRecording && userId && apiKey) {
      const componentIds = (demos || []).map(d => d.component_id).filter(Boolean) as number[]
      const authorIds = (demos || []).map(d => {
        const c = Array.isArray(d.component) ? d.component[0] : d.component
        return c?.user_id
      }).filter(Boolean) as string[]
      recordUsage(supabase, { userId, apiKey, search, componentIds, authorIds })
    }

    return NextResponse.json<SearchResponseMCP>({
      results: demosWithCodeAndRegistryDependencies,
      promptRule
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
