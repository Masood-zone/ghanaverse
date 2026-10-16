"use client"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { authClient } from "@/lib/auth-client"
import { PhotoUpload } from "./photo-upload"
import type { AccountData } from "@/types/viewer"
export function PersonalDetailsForm({ user }: { user: AccountData }) {
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
    <section className="mt-8 rounded-xl border bg-white p-5 md:p-7">
      <h2 className="text-xl font-bold">Personal Details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account identity is separate from each viewer profile.
      </p>
      <form
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
          <label className="gv-label">
            Full name
            <input
              className="gv-field"
              required
              maxLength={180}
              autoComplete="name"
              value={name}
              disabled={mutation.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="gv-label">
            Email address
            <input
              className="gv-field"
              value={user.email}
              readOnly
              type="email"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Your sign-in email is read-only.
            </span>
          </label>
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
