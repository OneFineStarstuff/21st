import { createClient } from "@supabase/supabase-js"

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
)

export async function getUserByUsername(username: string) {
  return await supabaseAdmin
    .from("users")
    .select("*")
    .or(`username.eq.${username},display_username.eq.${username}`)
    .single()
}

export async function checkUsernameTaken(username: string, excludeUserId?: string) {
  let query = supabaseAdmin
    .from("users")
    .select("id")
    .or(`username.eq."${username}",display_username.eq."${username}"`)

  if (excludeUserId) {
    query = query.neq("id", excludeUserId)
  }

  const { data, error } = await query
  return { data, error }
}
