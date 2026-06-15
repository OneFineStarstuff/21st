import { NextRequest, NextResponse } from "next/server"
import { stripeV2 } from "@/lib/stripe"
import { getStripeEvent } from "@/lib/stripe-utils"
import { handleSubscriptionCreatedOrUpdate, handleSubscriptionDeleted, handleFraudWarning, handleCheckoutSession } from "@/lib/stripe-webhooks"
import { supabaseWithAdminAccess } from "@/lib/supabase"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V2

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await getStripeEvent(req, stripeWebhookSecret, stripeV2)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { event } = result
  const supabase = supabaseWithAdminAccess

  const eventHandlers: Record<string, (event: any, supabase: any) => Promise<void>> = {
    "customer.subscription.created": handleSubscriptionCreatedOrUpdate,
    "customer.subscription.updated": handleSubscriptionCreatedOrUpdate,
    "customer.subscription.deleted": handleSubscriptionDeleted,
    "radar.early_fraud_warning.created": handleFraudWarning,
    "checkout.session.completed": handleCheckoutSession,
  }

  const handler = eventHandlers[event.type]
  if (handler) {
    await handler(event, supabase)
  }

  return NextResponse.json({ received: true })
}
