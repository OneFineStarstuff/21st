import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { handleSearchRequest } from "../_shared/search-utils.ts"

const model = new Supabase.ai.Session("gte-small")

Deno.serve(async (req) => {
  return handleSearchRequest(req, async (search, match_threshold) => {
    const output = await model.run(search, { mean_pool: true, normalize: true })
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    )
    const { data: searchResults, error } = await supabase.rpc("search_demos_ai", {
      search_query: search,
      query_embedding: JSON.stringify(output),
      match_threshold: match_threshold ?? 0.85,
    })
    if (error) throw new Error(error.message)
    return searchResults
  })
})
