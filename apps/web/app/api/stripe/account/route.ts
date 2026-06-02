import stripe from "@/lib/stripe"
import { getAuthenticatedStripeId } from "@/lib/stripe-auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { stripeId, errorResponse } = await getAuthenticatedStripeId()
  if (errorResponse) return errorResponse

  try {
    const account = await stripe.accounts.retrieve(stripeId!)
    return NextResponse.json(account)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get stripe account" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const { stripeId, errorResponse } = await getAuthenticatedStripeId()
  if (errorResponse) return errorResponse

  return NextResponse.json({ stripeId })
}
