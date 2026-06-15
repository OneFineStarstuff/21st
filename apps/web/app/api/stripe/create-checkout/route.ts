import { stripe, stripeV2, getIdBySubscriptionPlanDetails } from "@/lib/stripe"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { checkStripeAuth } from "@/lib/stripe-auth"
import { NextRequest, NextResponse } from "next/server"
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

export async function POST(request: NextRequest) {
  try {
    const { userId, response: authResponse } = await checkStripeAuth()
    if (authResponse) return authResponse

    const body = await request.json()

    const validationResult = checkoutSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.errors,
        },
        { status: 400 },
      )
    }

    const {
      planId,
      successUrl,
      cancelUrl,
      period,
      isUpgrade,
      currentPlanId,
      subscriptionId,
    } = validationResult.data

    const { data: user, error: userError } = await supabaseWithAdminAccess
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle()

    let priceId: string
    try {
      priceId = await getIdBySubscriptionPlanDetails(planId, period, 2)
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid subscription plan configuration" },
        { status: 400 },
      )
    }

    try {
      if (isUpgrade && currentPlanId !== "free" && subscriptionId) {
        try {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId)

          if (subscription.metadata.userId === userId) {
            const subscriptionItemId = subscription.items.data[0]?.id

            if (!subscriptionItemId) {
              throw new Error("Subscription item not found")
            }

            if (!planId) {
              throw new Error("Plan ID is undefined")
            }

            const updatedMetadata: Record<string, string> = {}

            for (const [key, value] of Object.entries(
              subscription.metadata || {},
            )) {
              if (value) updatedMetadata[key] = value
            }

            updatedMetadata.upgraded_from = currentPlanId || "free"
            updatedMetadata.upgraded_to = planId
            updatedMetadata.upgraded_at = new Date().toISOString()

            await stripe.subscriptions.update(
              subscription.id,
              {
                items: [
                  {
                    id: subscriptionItemId,
                    price: priceId,
                  },
                ],
                proration_behavior: "create_prorations",
                metadata: updatedMetadata,
              },
            )

            return NextResponse.json({
              url: successUrl,
              directly_upgraded: true,
            })
          }
        } catch (subscriptionError) {
          // Subscription error handled silently
        }
      }

      const session = await stripeV2.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        metadata: {
          userId,
          ...(isUpgrade && { isUpgrade: "true", oldPlanId: currentPlanId }),
        },
        ...(user?.email && { customer_email: user.email }),
        allow_promotion_codes: true,
        tax_id_collection: {
          enabled: true,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            userId,
            ...(isUpgrade && { upgraded_from: currentPlanId }),
          },
        },
      })

      return NextResponse.json({ url: session.url })
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
