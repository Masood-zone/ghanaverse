"use client"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AccountData } from "@/types/viewer"

export function PhoneSettings({ user }: { user: AccountData }) {
  const [phone, setPhone] = useState(user.phone ?? "")
  const [consent, setConsent] = useState(user.transactionalSmsConsent)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState("")
  const [resendAt, setResendAt] = useState(0)
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (action: "save" | "request" | "verify") => {
      if (action === "save")
        return api("/account/phone", {
          method: "PATCH",
          body: JSON.stringify({
            phone: phone || null,
            transactionalSmsConsent: consent,
          }),
        })
      if (action === "verify")
        return api("/account/phone/verify", {
          method: "POST",
          body: JSON.stringify({ code }),
        })
      const result = await api<{ message: string; resendAt: string }>(
        "/account/phone/request",
        { method: "POST" }
      )
      setResendAt(Date.parse(result.resendAt))
      return result
    },
    onSuccess: async (data, action) => {
      setMessage(
        action === "request" &&
          data &&
          typeof data === "object" &&
          "message" in data
          ? String(data.message)
          : action === "verify"
            ? "Number verified. You can now choose transactional SMS."
            : "Phone settings saved. Changing your number clears verification and SMS consent."
      )
      await client.invalidateQueries({ queryKey: ["viewer", "account"] })
    },
  })
  const changed = phone !== (user.phone ?? "")
  return (
    <section className="gv-sub-card">
      <h2 className="text-xl font-bold">Transactional notifications</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Email is the default for account, payment and creator updates. Optional
        SMS uses a verified Ghana number. Password recovery stays email-based.
      </p>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate("save")
        }}
      >
        <Label className="gv-label">
          Phone number (optional)
          <Input
            type="tel"
            autoComplete="tel"
            value={phone}
            maxLength={32}
            placeholder="024 123 4567"
            onChange={(e) => {
              setPhone(e.target.value)
              setConsent(false)
            }}
          />
        </Label>
        <p className="text-sm">
          {user.phoneVerifiedAt && !changed
            ? "Verified number"
            : "Number not verified"}
        </p>
        <Label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={consent}
            disabled={!user.phoneVerifiedAt || changed || mutation.isPending}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I agree to receive transactional SMS about my account, payments and
          creator activity.
        </Label>
        <button className="gv-action" disabled={mutation.isPending}>
          Save phone settings
        </button>
      </form>
      {user.phone && !user.phoneVerifiedAt && !changed ? (
        <div className="mt-5 space-y-4">
          <button
            type="button"
            className="gv-action-outline"
            disabled={mutation.isPending}
            onClick={() => {
              if (Date.now() < resendAt)
                setMessage(
                  "Wait at least one minute before requesting another code."
                )
              else mutation.mutate("request")
            }}
          >
            Send verification code
          </button>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate("verify")
            }}
          >
            <Label className="gv-label">
              Six-digit code
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Label>
            <button
              className="gv-action"
              disabled={mutation.isPending || code.length !== 6}
            >
              Verify number
            </button>
          </form>
          <p className="text-xs text-muted-foreground">
            Codes expire in five minutes. Five attempts per code; five sends per
            hour.
          </p>
        </div>
      ) : null}
      {mutation.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {mutation.error.message}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  )
}
