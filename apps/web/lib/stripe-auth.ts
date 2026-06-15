import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function checkStripeAuth() {
  const authSession = await auth()
  const userId = authSession?.userId
  if (!userId) {
    return { userId: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { userId, response: null }
}
