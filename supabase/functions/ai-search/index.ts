import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { handleSearchRequest, getSupabaseClient } from "../_shared/search-utils.ts"

const model = new Supabase.ai.Session("gte-small")

Deno.serve(async (req) => {
  return handleSearchRequest(req, async (search, match_threshold) => {
    const output = await model.run(search, { mean_pool: true, normalize: true })
    const supabase = getSupabaseClient(req)
    const { data: searchResults, error } = await supabase.rpc("search_demos_ai", {
      search_query: search,
      query_embedding: JSON.stringify(output),
      match_threshold: match_threshold ?? 0.85,
    })
    if (error) throw new Error(error.message)
    return searchResults
  })
})
