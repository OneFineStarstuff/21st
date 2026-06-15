"use client"

import { useClerkSupabaseClient } from "@/lib/clerk"
import { useQuery } from "@tanstack/react-query"
import { useIsAdmin } from "./use-is-admin"

export const usePublishAs = ({ username }: { username: string }) => {
  const client = useClerkSupabaseClient()
  const isCurrentUserAdmin = useIsAdmin()

  const { data: publishAsUser, isLoading: isPublishAsUserLoading } = useQuery({
    queryKey: ["publishAsUser", username],
    queryFn: async () => {
      const { data } = await client
        .from("users")
        .select("*")
        .eq("username", username)
        .single()
      return data
    },
    enabled: !!username,
  })

  return {
    isAdmin: isCurrentUserAdmin,
    user: publishAsUser,
    isLoading: isPublishAsUserLoading,
  }
}
