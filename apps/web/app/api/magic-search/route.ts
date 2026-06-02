import { NextRequest, NextResponse } from "next/server"
import { SearchResponseMCP } from "@/types/global"
import { resolveRegistryDependencyTree } from "@/lib/queries.server"
import fetchFileTextContent from "@/lib/utils/fetchFileTextContent"
import { getSearchSupabaseClient, validateSearchApiKey, recordUsage } from "@/lib/search-utils"

interface SearchResult {
  id: number
  usage_data?: {
    total_usages: number
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSearchSupabaseClient()
  const { success, apiKey, userId, error, status } = await validateSearchApiKey(request, supabase)
  if (!success) return NextResponse.json({ error }, { status })

  try {
    const body = await request.json()
    const {
      search,
      match_threshold = 0.33,
      limit = 3,
      userMessage = "",
      skipUsageRecording = false,
    } = body

    if (!search) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    const { data: searchResults, error: functionError } = await supabase.functions.invoke(
      "search-embeddings",
      { body: { search, match_threshold, userMessage } },
    )

    if (functionError) {
      return NextResponse.json({ error: "Error fetching search results" }, { status: 500 })
    }

    const searchResultsTruncated = searchResults.slice(0, limit) as SearchResult[]

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

      const searchResult = searchResultsTruncated.find((r: SearchResult) => r.id === demoRaw.id)

      return {
        demoName: demoRaw.name,
        demoCode: demoCode ?? "",
        componentName: component!.name,
        componentCode: componentCode ?? "",
        registryDependencies: registryDependencies || undefined,
        similarity: searchResult?.usage_data?.total_usages
          ? searchResult.usage_data.total_usages / 1000
          : undefined,
      }
    })

    const demosWithCodeAndRegistryDependencies = await Promise.all(promises)
    const sortedResults = demosWithCodeAndRegistryDependencies.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))

    if (!skipUsageRecording && userId && apiKey) {
      const componentIds = (demos || []).map(d => d.component_id).filter(Boolean) as number[]
      const authorIds = (demos || []).map(d => {
        const c = Array.isArray(d.component) ? d.component[0] : d.component
        return c?.user_id
      }).filter(Boolean) as string[]
      recordUsage(supabase, { userId, apiKey, search, componentIds, authorIds })
    }

    return NextResponse.json<SearchResponseMCP>({ results: sortedResults })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
