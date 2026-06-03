import { NextRequest, NextResponse } from "next/server"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { FREE_USAGE_LIMIT } from "@/lib/config/subscription-plans"
import { validateApiKey } from "@/lib/magic-auth"

export async function GET(request: NextRequest) {
  try {
    const { success, apiKeyData, userId, error, status } = await validateApiKey(request)
    if (!success) {
      return NextResponse.json({ success: false, error }, { status })
    }

    try {
      // Check available requests in usages table
      let { data: usageData, error: usageError } = await supabaseWithAdminAccess
        .from("usages")
        .select("*")
        .eq("user_id", userId)
        .single()

      if (usageError && usageError.code !== "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Failed to check usage limits" },
          { status: 500 },
        )
      }

      if (!usageData) {
        const { data: newUsage, error: insertError } =
          await supabaseWithAdminAccess
            .from("usages")
            .insert({
              user_id: userId,
              usage: 0,
              limit: FREE_USAGE_LIMIT,
            })
            .select()
            .single()

        if (insertError) {
          return NextResponse.json(
            { success: false, error: "Failed to create usage record" },
            { status: 500 },
          )
        }
        usageData = newUsage
      }

      const currentUsage = usageData?.usage || 0
      const usageLimit = usageData?.limit || 0

      if (currentUsage >= usageLimit) {
        return NextResponse.json(
          {
            success: false,
            error: "Usage limit exceeded",
            usage: currentUsage,
            limit: usageLimit,
            remaining: 0,
          },
          { status: 403 },
        )
      }

      const { error: updateError } = await supabaseWithAdminAccess
        .from("usages")
        .update({
          usage: currentUsage + 1,
        })
        .eq("user_id", userId)

      if (updateError) {
        return NextResponse.json(
          { success: false, error: "Failed to update usage count" },
          { status: 500 },
        )
      }

      await supabaseWithAdminAccess
        .from("api_keys")
        .update({
          last_used_at: new Date().toISOString(),
          requests_count: (apiKeyData!.requests_count || 0) + 1,
        })
        .eq("id", apiKeyData!.id)

      return NextResponse.json({
        success: true,
        message: "API key is valid and usage updated",
        usage: currentUsage + 1,
        limit: usageLimit,
        remaining: usageLimit - (currentUsage + 1),
      })
    } catch (error) {
      console.error("Supabase operation error:", error)
      return NextResponse.json(
        { success: false, error: "Database operation failed" },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error in magic/use endpoint:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
