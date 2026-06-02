import { supabaseWithAdminAccess } from "@/lib/supabase"

export async function validateApiKey(request: Request) {
  const { searchParams } = new URL(request.url)
  const apiKey = searchParams.get("apikey") || request.headers.get("x-api-key")

  if (!apiKey) {
    return { success: false, error: "Missing API key", status: 401 }
  }

  const { data, error } = await supabaseWithAdminAccess
    .from("api_keys")
    .select("*")
    .eq("key", apiKey)
    .eq("is_active", true)
    .single()

  if (error || !data) {
    return { success: false, error: "Invalid or inactive API key", status: 401 }
  }

  return { success: true, apiKeyData: data, userId: data.user_id }
}
