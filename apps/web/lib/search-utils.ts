import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { supabaseWithAdminAccess } from "./supabase"

export const getSearchSupabaseClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function validateSearchApiKey(request: Request, supabase: SupabaseClient) {
  const apiKey = request.headers.get("x-api-key")

  if (!apiKey) {
    return { success: false, error: "API key is required", status: 401 }
  }

  const { data: keyCheck, error: keyError } = await supabase.rpc(
    "check_api_key",
    { api_key: apiKey },
  )

  if (keyError || !keyCheck?.valid) {
    // Fallback check
    const { data: apiKeyData, error: apiKeyError } = await supabaseWithAdminAccess
      .from("api_keys")
      .select("*")
      .eq("key", apiKey)
      .eq("is_active", true)
      .single()

    if (apiKeyError || !apiKeyData) {
      return {
        success: false,
        error: keyCheck?.error || "Invalid or inactive API key",
        status: 401
      }
    }
    return { success: true, apiKey, keyCheck: { valid: true, plan: 'free', requests_remaining: 0 }, userId: apiKeyData.user_id }
  }

  // Get user ID from API key if not in keyCheck
  const { data: userData } = await supabase
    .from("api_keys")
    .select("user_id")
    .eq("key", apiKey)
    .single()

  return {
    success: true,
    apiKey,
    keyCheck,
    userId: userData?.user_id
  }
}

export function recordUsage(
  supabase: SupabaseClient,
  params: {
    userId: string,
    apiKey: string,
    search: string,
    componentIds: number[],
    authorIds: string[]
  }
) {
  const { userId, apiKey, search, componentIds, authorIds } = params
  if (componentIds.length > 0) {
    supabase.rpc("record_mcp_component_usage", {
      p_user_id: userId,
      p_api_key: apiKey,
      p_search_query: search,
      p_component_ids: componentIds,
      p_author_ids: authorIds,
    }).then(({ data, error }) => {
      if (error) console.error("Error recording usage:", error)
      else console.log("Usage recorded:", data)
    }).catch(err => console.error("Usage recording exception:", err))
  }
}
