import { NextResponse } from "next/server"
import { handleAuthenticatedRequest } from "@/lib/api-utils"
import { checkUsernameTaken } from "@/lib/user-utils"

export async function POST(req: Request) {
  return handleAuthenticatedRequest(req, async (userId, body) => {
    const { display_username } = body
    if (!display_username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    const { data: existingUsers, error: queryError } = await checkUsernameTaken(display_username, userId)
    if (queryError) {
      console.error("Username validation error:", queryError)
      return NextResponse.json({ error: "Validation failed" }, { status: 500 })
    }

    return NextResponse.json({
      exists: existingUsers && existingUsers.length > 0,
    })
  })
}
