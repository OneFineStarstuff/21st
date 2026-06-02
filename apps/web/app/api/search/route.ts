import { NextRequest, NextResponse } from "next/server"
import { SearchResponse } from "@/types/global"
import { getSearchSupabaseClient, validateSearchApiKey } from "@/lib/search-utils"

const SUPABASE_SEARCH_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-search-oai`

export async function POST(request: NextRequest) {
  const supabase = getSearchSupabaseClient()
  const { success, keyCheck, error, status } = await validateSearchApiKey(request, supabase)
  if (!success) return NextResponse.json({ error }, { status })

  try {
    const body = await request.json()
    const { search, page = 1, per_page = 20 } = body

    if (!search) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    const response = await fetch(SUPABASE_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ search }),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch from Supabase: ${await response.text()}`)
    }

    const data = await response.json()
    if (!Array.isArray(data)) throw new Error("Unexpected response format")

    const transformedResults = data
      .map((item: any) => ({
        name: item.name || "",
        preview_url: item.preview_url || "",
        video_url: item.video_url,
        demo_id: item.id,
        component_data: {
          name: item.component_data?.name || "",
          description: item.component_data?.description || "",
          code: item.component_data?.code || "",
          install_command: item.component_data?.install_command || "",
        },
        component_user_data: {
          name: item.user_data?.name || "",
          username: item.user_data?.username || "",
          image_url: item.user_data?.image_url || null,
        },
        usage_count: item.usage_data?.total_usages || 0,
      }))
      .sort((a, b) => b.usage_count - a.usage_count)

    const total = transformedResults.length
    const results = transformedResults.slice((page - 1) * per_page, page * per_page)

    return NextResponse.json<SearchResponse>({
      results,
      metadata: {
        plan: keyCheck.plan,
        requests_remaining: keyCheck.requests_remaining,
        pagination: {
          total,
          page,
          per_page,
          total_pages: Math.ceil(total / per_page),
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
