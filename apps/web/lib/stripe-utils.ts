import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { z } from "zod"

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

export function validateStripeRequest<T>(body: any, schema: z.ZodSchema<T>) {
  const validationResult = schema.safeParse(body)
  if (!validationResult.success) {
    return { error: NextResponse.json({ error: "Invalid data", details: validationResult.error.errors }, { status: 400 }) }
  }
  return { data: validationResult.data }
}
