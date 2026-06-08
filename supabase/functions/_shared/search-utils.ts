export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

export async function handleSearchRequest(req: Request, searchLogic: (search: string, match_threshold: number) => Promise<any>) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const { search, match_threshold = 0.5 } = await req.json()
  if (match_threshold < 0.1 || match_threshold > 0.99) {
    return new Response(JSON.stringify({ error: "match_threshold must be between 0.1 and 0.99" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
  const data = await searchLogic(search, match_threshold)
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
