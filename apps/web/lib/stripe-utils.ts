import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

export async function getStripeEvent(req: NextRequest, secret: string | undefined, stripe: Stripe) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")
  if (!sig || !secret) {
    return { error: "No signature or secret", status: 400 }
  }
  try {
    const event = stripe.webhooks.constructEvent(body, sig, secret)
    return { event }
  } catch (err) {
    return { error: "Webhook Error", status: 400 }
  }
}
