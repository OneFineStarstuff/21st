import { NextRequest } from "next/server"
import { handleCommonSearch } from "@/lib/search-route-utils"

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}))
  return handleCommonSearch(request, {
    functionName: "ai-search-oai",
    defaultLimit: 5,
    promptRuleId: body.promptRuleId
  })
}
