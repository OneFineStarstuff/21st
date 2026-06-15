import { NextRequest } from "next/server"
import { stripeV2 } from "@/lib/stripe"
import { handleStripeWebhookRoute, handleCheckoutSession } from "@/lib/stripe-webhooks"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V2

export async function POST(req: NextRequest) {
  return handleStripeWebhookRoute(req, stripeWebhookSecret, stripeV2, {
    "checkout.session.completed": (event) => handleCheckoutSession(event, stripeV2),
  })
}
