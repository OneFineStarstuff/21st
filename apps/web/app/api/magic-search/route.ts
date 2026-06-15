import { NextRequest } from "next/server"
import { handleCommonSearch } from "@/lib/search-route-utils"

export async function POST(request: NextRequest) {
  return handleCommonSearch(request, {
    functionName: "search-embeddings",
    defaultLimit: 3,
    includeSimilarity: true,
    additionalBodyFields: (body) => ({ userMessage: body.userMessage || "" }),
    sortResults: (results) => results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
  })
}
