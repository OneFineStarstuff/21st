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
