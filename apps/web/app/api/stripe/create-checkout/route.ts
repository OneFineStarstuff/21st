import { stripe, stripeV2, getIdBySubscriptionPlanDetails } from "@/lib/stripe"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { handleAuthenticatedRequest } from "@/lib/api-utils"
import { NextResponse } from "next/server"
import { z } from "zod"

const checkoutSchema = z.object({
  planId: z.enum(["pro", "pro_plus"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  period: z.enum(["monthly", "yearly"]),
  isUpgrade: z.boolean().optional(),
  currentPlanId: z.string().optional(),
  subscriptionId: z.string().optional(),
})

export async function POST(request: Request) {
  return handleAuthenticatedRequest(request, async (userId, body) => {
    const validationResult = checkoutSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid data", details: validationResult.error.errors }, { status: 400 })
    }

    const { planId, successUrl, cancelUrl, period, isUpgrade, currentPlanId, subscriptionId } = validationResult.data
    const { data: user } = await supabaseWithAdminAccess.from("users").select("email").eq("id", userId).maybeSingle()

    let priceId
    try {
      priceId = await getIdBySubscriptionPlanDetails(planId, period, 2)
    } catch (error) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    if (isUpgrade && currentPlanId !== "free" && subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        if (subscription.metadata.userId === userId) {
          const subscriptionItemId = subscription.items.data[0]?.id
          if (subscriptionItemId && planId) {
            const updatedMetadata = { ...subscription.metadata, upgraded_from: currentPlanId || "free", upgraded_to: planId, upgraded_at: new Date().toISOString() }
            await stripe.subscriptions.update(subscription.id, {
              items: [{ id: subscriptionItemId, price: priceId }],
              proration_behavior: "create_prorations",
              metadata: updatedMetadata as Record<string, string>,
            })
            return NextResponse.json({ url: successUrl, directly_upgraded: true })
          }
        }
      } catch (e) {}
    }

    const session = await stripeV2.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata: { userId, ...(isUpgrade && { isUpgrade: "true", oldPlanId: currentPlanId }) },
      ...(user?.email && { customer_email: user.email }),
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: { metadata: { userId, ...(isUpgrade && { upgraded_from: currentPlanId }) } },
    })

    return NextResponse.json({ url: session.url })
  })
}
