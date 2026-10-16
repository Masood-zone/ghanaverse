"use client"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { announceProfileChange } from "@/lib/viewer-events"
export const SIGNING_OUT_KEY = "ghanaverse.signing-out"
export function useSignOut() {
  const [pending, setPending] = useState(false)
  const client = useQueryClient()
  async function signOut() {
    if (pending || sessionStorage.getItem(SIGNING_OUT_KEY)) return
    setPending(true)
    sessionStorage.setItem(SIGNING_OUT_KEY, "true")
    try {
      await client.cancelQueries()
      const result = await authClient.signOut()
      if (result.error)
        throw new Error("Sign-out could not be completed. Please try again.")
      await client.cancelQueries()
      client.clear()
      announceProfileChange()
      window.location.replace(new URL("/", window.location.origin).href)
    } catch (error) {
      sessionStorage.removeItem(SIGNING_OUT_KEY)
      setPending(false)
      toast.error(
        error instanceof Error
          ? error.message
          : "Sign-out could not be completed."
      )
    }
  }
  return { pending, signOut }
}
