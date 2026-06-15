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

  const eventHandlers: Record<string, (event: any, supabase: any) => Promise<void>> = {
    "customer.subscription.created": handleSubscriptionCreatedOrUpdate,
    "customer.subscription.updated": handleSubscriptionCreatedOrUpdate,
    "customer.subscription.deleted": handleSubscriptionDeleted,
    "radar.early_fraud_warning.created": handleFraudWarning,
  }

  const handler = eventHandlers[event.type]
  if (handler) {
    await handler(event, supabase)
  }

  return NextResponse.json({ received: true })
}
