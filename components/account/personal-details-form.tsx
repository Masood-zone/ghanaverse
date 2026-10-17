"use client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { authClient } from "@/lib/auth-client"
import { PhotoUpload } from "./photo-upload"
import type { AccountData } from "@/types/viewer"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
export function PersonalDetailsForm({
  user,
  compact = false,
}: {
  user: AccountData
  compact?: boolean
}) {
  const [editing, setEditing] = useState(!compact)
  const [name, setName] = useState(user.name)
  const [image, setImage] = useState(user.image)
  const [photoAssetId, setPhotoAssetId] = useState<string | null | undefined>()
  const [uploading, setUploading] = useState(false)
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: () =>
      api("/account", {
        method: "PATCH",
        body: JSON.stringify({ name, photoAssetId }),
      }),
    onSuccess: async () => {
      await authClient.getSession({ query: { disableCookieCache: true } })
      await client.invalidateQueries({ queryKey: ["viewer", "account"] })
      toast.success("Your account details have been saved.")
    },
  })
  return (
    <section
      className={
        compact ? "gv-sub-card" : "mt-8 rounded-xl border bg-white p-5 md:p-7"
      }
    >
      <div className={compact ? "gv-sub-section-heading" : ""}>
        {compact ? (
          <span>
            <MaterialSymbol icon="person" />
          </span>
        ) : null}
        <div>
          <h2 className={compact ? "" : "text-xl font-bold"}>
            Personal Details
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account identity is separate from each viewer profile.
          </p>
        </div>
        {compact ? (
          <button
            type="button"
            aria-expanded={editing}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Close editor" : "✎ Edit Profile"}
          </button>
        ) : null}
      </div>
      {compact && !editing ? (
        <div className="gv-sub-detail-grid">
          <div className="gv-sub-inset">
            <small>Full name</small>
            <strong>{user.name}</strong>
          </div>
          <div className="gv-sub-inset">
            <small>Email address</small>
            <strong>{user.email}</strong>
          </div>
          <div className="gv-sub-inset">
            <small>Account role</small>
            <strong>{user.role.replaceAll("_", " ")}</strong>
          </div>
        </div>
      ) : null}
      <form
        hidden={!editing}
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <PhotoUpload
          target="account"
          name={name}
          image={image}
          onBusy={setUploading}
          disabled={mutation.isPending}
          onChange={(id, url) => {
            setPhotoAssetId(id)
            setImage(url)
          }}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Label className="gv-label">
            Full name
            <Input
              required
              maxLength={180}
              autoComplete="name"
              value={name}
              disabled={mutation.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </Label>
          <Label className="gv-label">
            Email address
            <Input value={user.email} readOnly type="email" />
            <span className="text-xs font-normal text-muted-foreground">
              Your sign-in email is read-only.
            </span>
          </Label>
        </div>
        {mutation.error ? (
          <p role="alert" className="text-sm text-red-700">
            {mutation.error.message}
          </p>
        ) : null}
        <button
          className="gv-action"
          disabled={uploading || mutation.isPending || !name.trim()}
        >
          {mutation.isPending ? "Saving…" : "Save account details"}
        </button>
      </form>
    </section>
  )
}
