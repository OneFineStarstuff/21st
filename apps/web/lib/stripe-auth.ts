import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getStripeId } from "./stripe"

export async function getAuthenticatedStripeId() {
  const { userId } = await auth()
  if (!userId) {
    return { userId: null, stripeId: null, errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  try {
    const stripeId = await getStripeId(userId)
    return { userId, stripeId, errorResponse: null }
  } catch (error) {
    console.error("Failed to get stripe ID:", error)
    return {
      userId,
      stripeId: null,
      errorResponse: NextResponse.json(
        { error: "Failed to get stripe account" },
        { status: 500 }
      )
    }
  }
}
