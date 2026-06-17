import { stripeV2 } from "@/lib/stripe"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { handleAuthenticatedRequest } from "@/lib/api-utils"
import { validateStripeRequest } from "@/lib/stripe-utils"
import { NextResponse } from "next/server"
import { z } from "zod"

const checkoutSchema = z.object({
  bundleId: z.number(),
  planId: z.number(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

export async function POST(request: Request) {
  return handleAuthenticatedRequest(request, async (userId, body) => {
    const { data, error } = validateStripeRequest(body, checkoutSchema)
    if (error) return error

    const { bundleId, planId, successUrl, cancelUrl } = data
    const { data: bundle } = await supabaseWithAdminAccess.from("bundles").select("*").eq("id", bundleId).single()
    if (!bundle || bundle.user_id === userId) return NextResponse.json({ error: "Invalid bundle" }, { status: 400 })

    const { data: plan } = await supabaseWithAdminAccess.from("bundle_plans").select("*").eq("id", planId).single()
    const { data: userData } = await supabaseWithAdminAccess.from("users").select("bundles_fee, email").eq("id", userId).single()
    if (!plan || !userData || plan.bundle_id !== bundle.id) return NextResponse.json({ error: "Invalid plan or user" }, { status: 400 })

    const session = await stripeV2.checkout.sessions.create({
      customer_email: userData.email,
      line_items: [{ price_data: { currency: "usd", product_data: { name: `Bundle "${bundle.name}" (${plan.type} plan)` }, unit_amount: plan.price }, quantity: 1 }],
      payment_intent_data: { transfer_group: `bundle-purchase-${userId}-${bundle.id}-${plan.id}`, metadata: { userId, bundleId, planId, fee: userData.bundles_fee } },
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return NextResponse.json({ url: session.url })
  })
}
