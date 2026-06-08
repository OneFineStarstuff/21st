import { NextRequest, NextResponse } from "next/server"
import { stripeV1 } from "@/lib/stripe"
import { getStripeEvent } from "@/lib/stripe-utils"
import { handleSubscriptionCreatedOrUpdate, handleSubscriptionDeleted, handleFraudWarning } from "@/lib/stripe-webhooks"
import { supabaseWithAdminAccess } from "@/lib/supabase"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V1

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await getStripeEvent(req, stripeWebhookSecret, stripeV1)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { event } = result
  const supabase = supabaseWithAdminAccess
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionCreatedOrUpdate(event, supabase)
      break
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event, supabase)
      break
    case "radar.early_fraud_warning.created":
      await handleFraudWarning(event, supabase)
      break
  }
  return NextResponse.json({ received: true })
}
