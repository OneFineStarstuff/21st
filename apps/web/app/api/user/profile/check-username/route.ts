import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { checkUsernameTaken } from "@/lib/user-utils"

export async function POST(req: Request) {
  try {
    const session = await auth()
    const userId = session?.userId
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { display_username } = body

    if (!display_username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      )
    }

    const { data: existingUsers, error: queryError } = await checkUsernameTaken(display_username, userId)

    if (queryError) {
      console.error("Username validation error:", queryError)
      return NextResponse.json(
        { error: "Failed to validate username" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      exists: existingUsers && existingUsers.length > 0,
    })
  } catch (error) {
    console.error("Error checking username:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
