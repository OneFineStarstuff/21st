import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { getOpenAIClient, generateEmbedding } from "../_shared/ai.ts"
import { handleSearchRequest } from "../_shared/search-utils.ts"

const openai = getOpenAIClient()

Deno.serve(async (req) => {
  return handleSearchRequest(req, async (search, match_threshold) => {
    const output = await generateEmbedding(openai, search)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    )
    const { data, error } = await supabase.rpc("search_demos_ai_oai_extended", {
      query_embedding: output,
      match_threshold: match_threshold ?? 0.5,
    })
    if (error) throw new Error(error.message)
    return data
  })
})
