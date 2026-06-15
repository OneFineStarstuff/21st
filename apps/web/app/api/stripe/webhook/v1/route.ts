import { NextRequest, NextResponse } from "next/server"
import { stripeV1 } from "@/lib/stripe"
import { getStripeEvent } from "@/lib/stripe-utils"
import { handleSubscriptionCreatedOrUpdate, handleSubscriptionDeleted, handleFraudWarning, processStripeWebhook } from "@/lib/stripe-webhooks"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V1

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await getStripeEvent(req, stripeWebhookSecret, stripeV1)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { event } = result

  await processStripeWebhook(event, {
    "customer.subscription.created": handleSubscriptionCreatedOrUpdate,
    "customer.subscription.updated": handleSubscriptionCreatedOrUpdate,
    "customer.subscription.deleted": handleSubscriptionDeleted,
    "radar.early_fraud_warning.created": (event) => handleFraudWarning(event, stripeV1),
  })

  return NextResponse.json({ received: true })
}
