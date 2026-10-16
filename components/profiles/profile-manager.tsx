"use client"

import { Check, Edit3, Plus, Trash2 } from "@/components/common/icons"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { useState, useEffect, useRef } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { profileSchema } from "@/lib/platform-validation"
import { QueryState } from "@/components/common/query-state"
import {
  useViewerProfiles,
  useSaveProfile,
  useDeleteProfile,
  useSelectProfile,
} from "@/services/viewer/profiles"
import { toast } from "sonner"
import type { ViewerProfile as Profile } from "@/types/viewer"
import { PhotoUpload } from "@/components/account/photo-upload"
import { PersonAvatar } from "@/components/catalogue/content-artwork"
import { safeCallbackUrl } from "@/lib/auth/callback"
import { announceProfileChange } from "@/lib/viewer-events"

const avatars = [
  "adinkra",
  "kente",
  "coast",
  "savannah",
  "highlife",
  "market",
] as const
const viewingPreferences = [
  {
    name: "isKids",
    title: "Kids mode",
    description:
      "Show U and PG titles only. Profile switching is unrestricted; this is not a parental lock.",
    icon: "family_restroom",
  },
  {
    name: "autoplayNextEpisode",
    title: "Autoplay next episode",
    description: "A cancellable countdown appears when an episode ends.",
    icon: "play_circle",
  },
  {
    name: "preferSubtitles",
    title: "Prefer subtitles when available",
    description:
      "YouTube retains its own CC controls and defaults when this is off.",
    icon: "closed_caption",
  },
] as const
const palettes: Record<string, string> = {
  adinkra: "from-amber-700 to-orange-400",
  kente: "from-red-700 to-amber-400",
  coast: "from-sky-700 to-cyan-300",
  savannah: "from-green-800 to-lime-400",
  highlife: "from-violet-800 to-fuchsia-400",
  market: "from-rose-700 to-orange-300",
}

export function ProfileManager({
  callbackUrl = "/",
}: {
  callbackUrl?: string
}) {
  const query = useViewerProfiles()
  const profiles = query.data?.profiles ?? [],
    activeId = query.data?.activeId
  const [editing, setEditing] = useState<Profile | "new" | null>(null),
    [manage, setManage] = useState(false)
  const selectMutation = useSelectProfile(),
    saveMutation = useSaveProfile(),
    deleteMutation = useDeleteProfile()
  if (!query.data)
    return (
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
    )
  return (
    <div>
      <div className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
        {profiles.map((profile) => (
          <div key={profile.id} className="text-center">
            <button
              aria-label={`${manage ? "Edit" : "Select"} ${profile.name}`}
              disabled={selectMutation.isPending}
              onClick={() =>
                manage
                  ? setEditing(profile)
                  : selectMutation.mutate(profile.id, {
                      onSuccess: () => {
                        announceProfileChange()
                        window.location.assign(safeCallbackUrl(callbackUrl))
                      },
                      onError: (error) => toast.error(error.message),
                    })
              }
              className="group relative mx-auto block"
            >
              <span
                className={`grid aspect-square w-32 place-items-center overflow-hidden rounded-xl border-4 bg-gradient-to-br ${palettes[profile.avatar ?? "adinkra"]} text-4xl font-black text-white shadow-lg transition group-hover:-translate-y-1 group-hover:shadow-xl sm:w-36`}
              >
                {profile.image ? (
                  <PersonAvatar
                    name={profile.name}
                    src={profile.image}
                    className="h-full w-full rounded-none"
                  />
                ) : (
                  profile.name.slice(0, 1).toUpperCase()
                )}
              </span>
              {profile.id === activeId ? (
                <span className="absolute -top-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-green-600 text-white shadow">
                  <Check className="h-4 w-4" />
                </span>
              ) : null}
              {manage ? (
                <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/40 text-white">
                  <Edit3 />
                </span>
              ) : null}
            </button>
            <h2 className="mt-4 font-bold">{profile.name}</h2>
            {profile.isKids ? (
              <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                Kids · U &amp; PG
              </span>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {profile.id === activeId ? "Active profile" : "Viewer profile"}
            </p>
            {manage ? (
              <button
                disabled={profiles.length <= 1 || deleteMutation.isPending}
                onClick={() => {
                  if (confirm(`Delete ${profile.name}?`))
                    deleteMutation.mutate(profile.id, {
                      onSuccess: () => {
                        sessionStorage.setItem(
                          "ghanaverse.notice",
                          "Profile deleted."
                        )
                        announceProfileChange()
                        window.location.reload()
                      },
                      onError: (error) => toast.error(error.message),
                    })
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-destructive disabled:opacity-30"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            ) : null}
          </div>
        ))}
        {profiles.length < 5 ? (
          <button
            onClick={() => setEditing("new")}
            className="mx-auto text-center"
          >
            <span className="grid aspect-square w-32 place-items-center rounded-xl border-2 border-dashed bg-white text-muted-foreground sm:w-36">
              <Plus className="h-9 w-9" />
            </span>
            <span className="mt-4 block font-bold">Add Profile</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Up to 5 total
            </span>
          </button>
        ) : null}
      </div>
      <div className="mt-12 flex justify-center">
        <button
          onClick={() => setManage((value) => !value)}
          className="inline-flex items-center gap-2 rounded-md border bg-white px-6 py-3 font-bold"
        >
          <Edit3 className="h-4 w-4" />
          {manage ? "Close" : "Manage Profiles"}
        </button>
      </div>
      {editing ? (
        <ProfileDialog
          profile={editing}
          pending={saveMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(values) =>
            saveMutation.mutate(
              { profile: editing, values },
              {
                onSuccess: () => {
                  setEditing(null)
                  toast.success("Profile saved")
                  sessionStorage.setItem("ghanaverse.notice", "Profile saved.")
                  announceProfileChange()
                  window.location.reload()
                },
                onError: (error) => toast.error(error.message),
              }
            )
          }
        />
      ) : null}
    </div>
  )
}

function ProfileDialog({
  profile,
  pending,
  onClose,
  onSave,
}: {
  profile: Profile | "new"
  pending: boolean
  onClose: () => void
  onSave: (values: z.output<typeof profileSchema>) => void
}) {
  const form = useForm<
    z.input<typeof profileSchema>,
    unknown,
    z.output<typeof profileSchema>
  >({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile === "new" ? "" : profile.name,
      isKids: profile === "new" ? false : profile.isKids,
      autoplayNextEpisode:
        profile === "new" ? false : profile.autoplayNextEpisode,
      preferSubtitles: profile === "new" ? false : profile.preferSubtitles,
      avatar:
        profileSchema.shape.avatar.safeParse(
          profile === "new" ? "adinkra" : profile.avatar
        ).data ?? "adinkra",
    },
  })
  const [image, setImage] = useState(profile === "new" ? null : profile.image)
  const [uploading, setUploading] = useState(false)
  const avatar = useWatch({ control: form.control, name: "avatar" }),
    dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-labelledby="profile-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending && !uploading) onClose()
      }}
      className="fixed inset-0 m-auto h-fit max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-xl bg-white p-6 text-left shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (!pending && !uploading) onSave(values)
        })}
      >
        <h2 id="profile-dialog-title" className="text-2xl font-extrabold">
          {profile === "new" ? "Add Profile" : "Edit Profile"}
        </h2>
        <div className="mt-5">
          <PhotoUpload
            target="profile"
            profileId={profile === "new" ? undefined : profile.id}
            name={profile === "new" ? "New profile" : profile.name}
            image={image}
            disabled={pending}
            onBusy={setUploading}
            onChange={(id, url) => {
              form.setValue("photoAssetId", id, { shouldDirty: true })
              setImage(url)
            }}
          />
        </div>
        <label className="mt-6 block text-sm font-bold">
          Profile name
          <input
            {...form.register("name")}
            aria-invalid={!!form.formState.errors.name}
            maxLength={40}
            className="mt-2 h-11 w-full rounded-md border px-3 font-normal"
          />
        </label>
        {form.formState.errors.name ? (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {form.formState.errors.name.message}
          </p>
        ) : null}
        <fieldset className="mt-5">
          <legend className="text-sm font-bold">Avatar</legend>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {avatars.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => {
                  form.setValue("avatar", item, { shouldDirty: true })
                  form.setValue("photoAssetId", null, { shouldDirty: true })
                  setImage(null)
                }}
                aria-label={item}
                aria-pressed={avatar === item}
                className={`aspect-square rounded-md bg-gradient-to-br ${palettes[item]} ${avatar === item ? "ring-2 ring-primary ring-offset-2" : ""}`}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-7 min-w-0">
          <legend className="text-sm font-bold">Viewing preferences</legend>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Make this profile feel like you.
          </p>
          <div className="mt-3 divide-y overflow-hidden rounded-xl border bg-muted/30">
            {viewingPreferences.map(({ name, title, description, icon }) => (
              <label
                key={name}
                className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-muted/70 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60 has-[:focus-visible]:bg-muted/70"
              >
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary sm:inline-flex">
                  <MaterialSymbol icon={icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    id={`preference-${name}-label`}
                    className="block text-sm leading-5 font-semibold"
                  >
                    {title}
                  </span>
                  <span
                    id={`preference-${name}-description`}
                    className="mt-1 block text-xs leading-5 text-muted-foreground"
                  >
                    {description}
                  </span>
                </span>
                <span className="relative mt-0.5 inline-flex shrink-0">
                  <Controller
                    name={name}
                    control={form.control}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        name={field.name}
                        ref={field.ref}
                        checked={Boolean(field.value)}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                        onBlur={field.onBlur}
                        aria-labelledby={`preference-${name}-label`}
                        aria-describedby={`preference-${name}-description`}
                        disabled={pending || uploading}
                        className="peer sr-only"
                      />
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className="inline-flex h-6 w-11 items-center rounded-full bg-slate-300 p-0.5 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:[&>span]:translate-x-5"
                  >
                    <span className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none" />
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            disabled={pending || uploading}
            onClick={onClose}
            className="rounded-md border px-4 py-2 font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={pending || uploading}
            className="rounded-md bg-primary px-4 py-2 font-bold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>
    </dialog>
  )
}
