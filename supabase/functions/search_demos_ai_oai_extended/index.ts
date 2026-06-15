import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { handleOaiSearchRequest } from "../_shared/search-utils.ts"

Deno.serve(async (req) => {
  return handleOaiSearchRequest(req, "search_demos_ai_oai_extended", 0.5, false)
})
