import stripe from "@/lib/stripe"
import { getAuthenticatedStripeId } from "@/lib/stripe-auth"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { userId, stripeId, errorResponse } = await getAuthenticatedStripeId()
  if (errorResponse) return errorResponse

  try {
    const { data: userData, error: userError } = await supabaseWithAdminAccess
      .from("users")
      .select("display_username")
      .eq("id", userId!)
      .single()

    if (userError) {
      return NextResponse.json(
        { error: "Failed to get user data" },
        { status: 500 },
      )
    }

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/studio/${userData.display_username}/monetization`

    const accountLink = await stripe.accountLinks.create({
      account: stripeId!,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get stripe account" },
      { status: 500 },
    )
  }
}
