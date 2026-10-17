"use client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { authClient } from "@/lib/auth-client"
import { FormError } from "@/components/admin/shared"
type Values = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
export function PasswordForm() {
  const form = useForm<Values>()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  return (
    <section className="mt-6 rounded-xl border bg-white p-5 md:p-7">
      <h2 className="font-bold">Change password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose your own password. Other signed-in sessions will be revoked.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit(async (values) => {
          setMessage("")
          setError("")
          if (values.newPassword !== values.confirmPassword) {
            form.setError("confirmPassword", {
              message: "Passwords do not match",
            })
            return
          }
          try {
            const result = await authClient.changePassword({
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
              revokeOtherSessions: true,
            })
            if (result.error)
              setError(
                "Password could not be changed. Check your current password and try again."
              )
            else {
              form.reset()
              setMessage("Password changed successfully.")
            }
          } catch {
            setError("Password could not be changed. Please try again.")
          }
        })}
      >
        <Label className="gv-label sm:col-span-2">
          Current password
          <Input
            type="password"
            required
            autoComplete="current-password"
            {...form.register("currentPassword")}
          />
        </Label>
        <Label className="gv-label">
          New password
          <Input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            {...form.register("newPassword")}
          />
        </Label>
        <Label className="gv-label">
          Confirm new password
          <Input
            type="password"
            required
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          <FormError message={form.formState.errors.confirmPassword?.message} />
        </Label>
        <div className="sm:col-span-2">
          <FormError message={error} />
          {message ? (
            <p role="status" className="text-sm text-green-800">
              {message}
            </p>
          ) : null}
          <button
            className="gv-action mt-3"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </section>
  )
}
