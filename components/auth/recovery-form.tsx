"use client"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "@/components/common/app-link"
export function RecoveryForm({
  token,
  invalid,
}: {
  token?: string
  invalid?: boolean
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-20">
      <h1 className="text-3xl font-extrabold">
        {token ? "Choose a new password" : "Recover your account"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {token
          ? "This secure link can be used once. Resetting your password signs out your existing sessions."
          : "Enter your sign-in email to request a secure password reset link."}
      </p>
      {invalid ? (
        <p role="alert" className="mt-4 text-red-700">
          This recovery link is invalid or expired. Request another link.
        </p>
      ) : null}
      <form
        className="mt-7 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setError("")
          setPending(true)
          try {
            if (token && password !== confirm) {
              setError("Passwords do not match.")
              return
            }
            const result = token
              ? await authClient.resetPassword({ token, newPassword: password })
              : await authClient.requestPasswordReset({
                  email,
                  redirectTo: `${window.location.origin}/auth/recovery`,
                })
            if (result.error)
              setError(
                token
                  ? "This link is invalid or expired. Request another recovery email."
                  : "Recovery is currently unavailable. Please try again later."
              )
            else
              setMessage(
                token
                  ? "Your password has been reset. Sign in using your new password."
                  : "If an account uses this email, a recovery link has been requested. Check your inbox and spam folder."
              )
          } catch {
            setError(
              "Recovery is currently unavailable. Please try again later."
            )
          } finally {
            setPending(false)
          }
        }}
      >
        {token ? (
          <>
            <Label className="gv-label">
              New password
              <Input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Label>
            <Label className="gv-label">
              Confirm password
              <Input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Label>
          </>
        ) : (
          <Label className="gv-label">
            Email address
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Label>
        )}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
        <button
          className="gv-action"
          disabled={pending || Boolean(token && message)}
        >
          {pending
            ? "Please wait…"
            : token
              ? "Reset password"
              : "Request recovery email"}
        </button>
      </form>
      <Link
        className="mt-6 inline-block text-sm font-semibold text-primary"
        href="/auth"
      >
        Return to sign in
      </Link>
    </main>
  )
}
