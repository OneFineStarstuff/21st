import { NextRequest } from "next/server"
import { stripeV1 } from "@/lib/stripe"
import { handleStripeWebhookRoute } from "@/lib/stripe-webhooks"

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET_V1

export async function POST(req: NextRequest) {
  return handleStripeWebhookRoute(req, stripeWebhookSecret, stripeV1)
}
