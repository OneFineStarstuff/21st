import { NextRequest, NextResponse } from "next/server"
import { checkStripeAuth } from "@/lib/stripe-auth"
import { stripeV1, stripeV2 } from "@/lib/stripe"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { Database } from "@/types/supabase"

type Plan = Database["public"]["Tables"]["plans"]["Row"]

interface UserPlanMeta {
  stripe_subscription_id?: string
  stripe_customer_id?: string
  stripe_plan_id?: string
  period_end?: string
  will_cancel_at_end?: boolean
  cancel_at?: string | null
}

interface UserPlanWithPlans {
  meta: UserPlanMeta | null
  plans: Pick<Plan, "version"> | null
}

export async function POST(request: NextRequest) {
  try {
    const { userId, response: authResponse } = await checkStripeAuth()
    if (authResponse) return authResponse

    const { data: userPlan, error: userPlanError } =
      await supabaseWithAdminAccess
        .from("users_to_plans")
        .select(
          `
          meta,
          plans:plan_id (
            version
          )
        `,
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .single<UserPlanWithPlans>()

    const subscriptionId =
      userPlan?.meta && (userPlan.meta as UserPlanMeta).stripe_subscription_id

    if (userPlanError || !subscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      )
    }

    const planVersion = userPlan.plans?.version || 1
    const stripeInstance = planVersion === 1 ? stripeV1 : stripeV2

    try {
      const subscription =
        await stripeInstance.subscriptions.cancel(subscriptionId)

      if (subscription.status === "canceled") {
        return NextResponse.json({
          success: true,
          message: "Subscription successfully canceled",
        })
      }

      return NextResponse.json(
        { error: "Failed to cancel subscription" },
        { status: 500 },
      )
    } catch (stripeError: any) {
      console.error("Stripe error:", stripeError)
      return NextResponse.json(
        {
          error: stripeError.message || "Failed to cancel subscription",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error in cancel-subscription:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
