import { NextResponse } from "next/server"
import { checkAuth, parseJsonBody } from "./auth-utils"

export async function handleAuthenticatedRequest(
  req: Request,
  handler: (userId: string, body: any) => Promise<NextResponse>
) {
  try {
    const { userId, response: authError } = await checkAuth()
    if (authError) return authError

    const body = await parseJsonBody(req)
    return await handler(userId!, body)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
