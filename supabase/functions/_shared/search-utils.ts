import { createClient } from "jsr:@supabase/supabase-js@2"
import { getOpenAIClient, generateEmbedding } from "./ai.ts"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

export async function handleSearchRequest(req: Request, searchLogic: (search: string, match_threshold: number | undefined) => Promise<any>) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  let search, match_threshold
  try {
    const body = await req.json()
    search = body.search
    match_threshold = body.match_threshold
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (match_threshold !== undefined && (match_threshold < 0.1 || match_threshold > 0.99)) {
    return new Response(JSON.stringify({ error: "match_threshold must be between 0.1 and 0.99" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const data = await searchLogic(search, match_threshold)
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
}

export function getSupabaseClient(req: Request, withAuth: boolean = true) {
  const options = withAuth ? { global: { headers: { Authorization: req.headers.get("Authorization")! } } } : {}
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    options
  )
}

const openai = getOpenAIClient()

export async function handleOaiSearchRequest(req: Request, rpcName: string, defaultThreshold: number, withAuth: boolean = true) {
  return handleSearchRequest(req, async (search, match_threshold) => {
    const output = await generateEmbedding(openai, search)
    const supabase = getSupabaseClient(req, withAuth)
    const { data, error } = await supabase.rpc(rpcName, {
      search_query: search,
      query_embedding: JSON.stringify(output),
      match_threshold: match_threshold ?? defaultThreshold,
    })
    if (error) throw new Error(error.message)
    return data
  })
}
