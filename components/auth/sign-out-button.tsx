"use client"
import { useSignOut } from "./use-sign-out"
export function SignOutButton() {
  const { signOut, pending } = useSignOut()
  return (
    <button
      className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-red-50"
      onClick={signOut}
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign Out"}
    </button>
  )
}
