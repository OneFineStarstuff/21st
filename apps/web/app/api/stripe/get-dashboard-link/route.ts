import stripe from "@/lib/stripe"
import { getAuthenticatedStripeId } from "@/lib/stripe-auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { stripeId, errorResponse } = await getAuthenticatedStripeId()
  if (errorResponse) return errorResponse

  try {
    const accountLink = await stripe.accounts.createLoginLink(stripeId!)
    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get stripe account" },
      { status: 500 },
    )
  }
}
