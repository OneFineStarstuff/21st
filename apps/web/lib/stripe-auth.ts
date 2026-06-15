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

export async function validateCheckoutRequest(req: Request, schema: any) {
  const { userId, response: authResponse } = await checkStripeAuth()
  if (authResponse) return { userId: null, data: null, response: authResponse }

  const body = await req.json()
  const validationResult = schema.safeParse(body)
  if (!validationResult.success) {
    return {
      userId,
      data: null,
      response: NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.errors },
        { status: 400 }
      )
    }
  }

  return { userId, data: validationResult.data, response: null }
}
