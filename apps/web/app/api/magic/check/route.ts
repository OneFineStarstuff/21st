import { NextRequest, NextResponse } from "next/server"
import { validateApiKey } from "@/lib/magic-auth"

export async function GET(request: NextRequest) {
  try {
    const { success, error, status } = await validateApiKey(request)
    if (!success) {
      return NextResponse.json({ success: false, error }, { status })
    }

    return NextResponse.json({
      success: true,
      message: "API key is valid and active",
    })
  } catch (error) {
    console.error("Error in magic/check endpoint:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
