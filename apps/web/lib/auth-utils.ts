import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function checkAuth() {
  const session = await auth()
  const userId = session?.userId

  if (!userId) {
    return { userId: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { userId, response: null }
}

export async function parseJsonBody(req: Request) {
  try {
    return await req.json()
  } catch (e) {
    return null
  }
}
