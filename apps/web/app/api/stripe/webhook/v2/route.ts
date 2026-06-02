import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { stripeV2 } from "@/lib/stripe"
import {
  handleSubscriptionCreatedOrUpdate,
  handleSubscriptionDeleted,
  handleFraudWarning,
  handleCheckoutSession
} from "@/lib/stripe-webhooks"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V2

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json(
      { error: "No Stripe signature found" },
      { status: 400 },
    )
  }

  let event: Stripe.Event

  try {
    event = stripeV2.webhooks.constructEvent(body, sig, stripeWebhookSecret!)
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 },
    )
  }

  const eventObject = event.data.object
  let userId

  if ("metadata" in eventObject && eventObject.metadata?.userId) {
    userId = eventObject.metadata.userId
  } else {
    return NextResponse.json(
      { error: "No userId found in event object metadata" },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdate(event)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event)
        break
      case "radar.early_fraud_warning.created":
        await handleFraudWarning(event, stripeV2)
        break
      case "payment_intent.canceled":
      case "payment_intent.payment_failed":
      case "payment_intent.processing":
      case "payment_intent.succeeded":
        await handleCheckoutSession(event, stripeV2)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 },
    )
  }
}
