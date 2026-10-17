"use client"
import {
  FormSelect,
  FormSwitch,
  FormCheckbox,
} from "@/components/ui/form-controls"
import { SettingRow } from "@/components/ui/setting-row"
import { SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAdminOptions } from "@/services/admin/metadata"
import { useAdminContentRecord } from "@/services/admin/content"
import { useEffect } from "react"
import Link from "@/components/common/app-link"
import {  useSearchParams, usePathname } from "next/navigation"
import { useNavigationRouter as useRouter } from "@/components/providers/navigation-loading"
import { useForm, FormProvider, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { toast } from "sonner"
import {
  ContentType,
  CreditType,
  MediaRights,
} from "@/app/generated/prisma/enums"
import { contentMutationSchema } from "@/lib/platform-validation"
import { publicationIssues } from "@/lib/validation/admin"
import { ApiClientError } from "@/lib/api-client-error"
import FileUpload from "@/components/common/FileUpload"
import { useAdminMutation } from "@/services/admin/queries"
import { toOptionalNumber } from "@/lib/validation/form-values"
import type { AdminOptions, EditorRecord } from "@/types/admin"
import { Heading, QueryState, Status, FormError } from "./shared"
import { SeriesMediaContent } from "./series-media-content"
import { ContentScope, useContentScope } from "./content-scope"
import { selectPlaybackAsset } from "@/lib/series"
type Input = z.input<typeof contentMutationSchema>
type Output = z.output<typeof contentMutationSchema>
function defaults(record?: EditorRecord): Input {
  return {
    title: record?.title ?? "",
    slug: record?.slug,
    shortDescription: record?.shortDescription ?? "",
    description: record?.description ?? "",
    tagline: record?.tagline ?? null,
    releaseYear: record?.releaseYear ?? null,
    releaseDate: record?.releaseDate ?? null,
    country: record?.country ?? "Ghana",
    seriesStatus: record?.seriesStatus ?? null,
    contentType: record?.contentType ?? "MOVIE",
    runtimeMinutes: record?.runtimeMinutes ?? null,
    classification: record?.classification ?? null,
    publicationStatus: record?.publicationStatus ?? "DRAFT",
    isFeatured: record?.isFeatured ?? false,
    isPremium: record?.isPremium ?? false,
    posterUrl: record?.posterUrl ?? null,
    backdropUrl: record?.backdropUrl ?? null,
    mediaRights: record?.mediaRights ?? "UNKNOWN",
    attributionNotes: record?.attributionNotes ?? null,
    productionCompanyId: record?.productionCompanyId ?? null,
    rightsHolderId: record?.rightsHolderId ?? null,
    genreIds: record?.genres.map((g) => g.genreId) ?? [],
    languageIds: record?.languages.map((l) => l.languageId) ?? [],
    credits:
      record?.credits.map((c) => ({
        personId: c.personId,
        creditType: c.creditType,
        characterName: c.characterName,
      })) ?? [],
  }
}
const tabs = [
  ["overview", "Overview"],
  ["artwork", "Artwork"],
  ["episodes", "Episodes"],
  ["video", "Video & Trailer"],
  ["people", "People & Rights"],
  ["publishing", "Publishing"],
] as const
function EditorForm({
  record,
  options,
}: {
  record?: EditorRecord
  options: AdminOptions
}) {
  const router = useRouter()
  const scope = useContentScope(),
    search = useSearchParams(),
    pathname = usePathname()
  const section = search.get("section")
  const active = tabs.find(([id]) => id === section)?.[0] ?? "overview"
  function setActive(id: (typeof tabs)[number][0]) {
    const params = new URLSearchParams(search.toString())
    params.set("section", id)
    window.history.pushState(null, "", `${pathname}?${params}`)
  }
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(contentMutationSchema),
    defaultValues: defaults(record),
    shouldUnregister: false,
  })
  const credits = useFieldArray({ control: form.control, name: "credits" })
  const mutation = useAdminMutation()
  const publication = useAdminMutation()
  const type = useWatch({ control: form.control, name: "contentType" })
  const posterUrl = useWatch({ control: form.control, name: "posterUrl" })
  const backdropUrl = useWatch({ control: form.control, name: "backdropUrl" })
  const published = record?.publicationStatus === "PUBLISHED"
  const dirty = form.formState.isDirty
  const visibleTabs = tabs.filter(
    ([id]) => id !== "episodes" || type === "SERIES"
  )
  useEffect(() => {
    if (!dirty) return
    const listener = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest("a[href]")
      if (
        anchor &&
        anchor.getAttribute("href") !== window.location.pathname &&
        !confirm("Discard unsaved changes?")
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener("click", navigate, true)
    window.addEventListener("beforeunload", listener)
    return () => {
      window.removeEventListener("beforeunload", listener)
      document.removeEventListener("click", navigate, true)
    }
  }, [dirty])
  const issues = record
    ? publicationIssues(record)
    : ["Save the title before previewing or publishing"]
  async function save(values: Output) {
    try {
      const saved = await mutation.mutateAsync({
        path: record ? `content/${record.id}` : "content",
        method: record ? "PATCH" : "POST",
        body: {
          ...values,
          ...(scope === "creator"
            ? { isFeatured: undefined, isPremium: undefined }
            : {}),
          publicationStatus: record?.publicationStatus ?? "DRAFT",
        },
      })
      form.reset({
        ...form.getValues(),
        slug: form.getValues("slug") || undefined,
      })
      toast.success("Title saved")
      if (!record) router.replace(`/${scope}/content/${saved.id}`)
    } catch (error) {
      if (error instanceof ApiClientError && error.fieldErrors) {
        for (const [name, messages] of Object.entries(error.fieldErrors))
          form.setError(name as keyof Input, { message: messages.join(". ") })
      }
      toast.error(error instanceof Error ? error.message : "Save failed")
    }
  }
  return (
    <>
      <div className="sticky top-16 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 p-4 shadow-sm backdrop-blur">
        <Link
          className="text-xs font-semibold text-primary"
          href={`/${scope}/content`}
        >
          ← Back to Content Library
        </Link>
        <div className="flex flex-wrap gap-2">
          {record ? (
            <>
              <Link
                className="gv-action secondary"
                href={`/${scope}/content/${record.id}/preview`}
              >
                Preview on GhanaVerse
              </Link>
              <button
                className={`gv-action ${published ? "danger" : ""}`}
                disabled={publication.isPending || dirty}
                onClick={() => {
                  if (
                    confirm(
                      `${published ? "Unpublish" : "Publish"} ${record.title}?`
                    )
                  )
                    publication.mutate(
                      {
                        path: `content/${record.id}/publication`,
                        method: "PATCH",
                        body: {
                          status: published ? "UNPUBLISHED" : "PUBLISHED",
                        },
                      },
                      {
                        onSuccess: () => toast.success("Publication updated"),
                        onError: (e) => toast.error(e.message),
                      }
                    )
                }}
              >
                {published ? "Unpublish to edit" : "Publish"}
              </button>
            </>
          ) : null}
          <button
            type="submit"
            form="content-editor"
            disabled={published || mutation.isPending}
            className="gv-action"
          >
            {mutation.isPending
              ? "Saving…"
              : record
                ? "Save Changes"
                : "Save Draft"}
          </button>
          <span className="text-xs font-semibold" role="status">
            {dirty ? "Unsaved changes" : "Saved"} ·{" "}
            {record?.title ?? "New title"}
          </span>
        </div>
      </div>
      <Heading
        eyebrow="Content master record"
        title={record ? `Editing: ${record.title}` : "Add Content"}
        actions={<Status value={record?.publicationStatus ?? "DRAFT"} />}
      />
      {published ? (
        <p className="mb-5 rounded-lg bg-amber-50 p-4 text-sm">
          This title is live. Unpublish it before editing metadata, artwork,
          seasons, trailers, or playback.
        </p>
      ) : null}
      {dirty ? (
        <p className="mb-4 text-xs font-semibold text-primary">
          Unsaved changes · Save before publishing or previewing.
        </p>
      ) : null}
      <FormProvider {...form}>
        <form
          id="content-editor"
          noValidate
          onSubmit={form.handleSubmit(save, (errors) => {
            const field = Object.keys(errors)[0] as keyof Input | undefined
            const target =
              field && ["posterUrl", "backdropUrl"].includes(field)
                ? "artwork"
                : field &&
                    [
                      "credits",
                      "productionCompanyId",
                      "rightsHolderId",
                      "mediaRights",
                      "attributionNotes",
                    ].includes(field)
                  ? "people"
                  : "overview"
            setActive(target)
            if (field) requestAnimationFrame(() => form.setFocus(field))
          })}
        >
          <div
            role="tablist"
            aria-label="Content sections"
            className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-white p-2"
          >
            {visibleTabs.map(([id, label]) => (
              <button
                key={id}
                id={`tab-${id}`}
                aria-controls={`panel-${id}`}
                aria-selected={active === id}
                role="tab"
                tabIndex={active === id ? 0 : -1}
                type="button"
                onKeyDown={(event) => {
                  const index = visibleTabs.findIndex((tab) => tab[0] === id)
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % visibleTabs.length
                      : event.key === "ArrowLeft"
                        ? (index + visibleTabs.length - 1) % visibleTabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? visibleTabs.length - 1
                            : -1
                  if (next >= 0) {
                    event.preventDefault()
                    setActive(visibleTabs[next][0])
                    document
                      .getElementById(`tab-${visibleTabs[next][0]}`)
                      ?.focus()
                  }
                }}
                onClick={() => setActive(id)}
                className={`rounded-md px-4 py-3 text-xs font-bold whitespace-nowrap ${active === id ? "bg-[#8d4b00] text-white" : "text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <fieldset disabled={published || mutation.isPending}>
            <div className="grid items-start gap-6">
              <div
                className="gv-panel space-y-5"
                hidden={
                  active === "artwork" ||
                  active === "episodes" ||
                  active === "video"
                }
              >
                {Object.keys(form.formState.errors).length ? (
                  <div
                    role="alert"
                    className="rounded-md bg-red-50 p-3 text-sm text-red-700"
                  >
                    Please correct:{" "}
                    {Object.keys(form.formState.errors).join(", ")}. Check the
                    corresponding section.
                  </div>
                ) : null}
                <section
                  hidden={active !== "overview"}
                  id="panel-overview"
                  role="tabpanel"
                  aria-labelledby="tab-overview"
                  className="space-y-5"
                >
                  <h2 className="text-xl font-bold text-primary">
                    General Information
                  </h2>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    {Object.values(ContentType).map((value) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() =>
                          form.setValue("contentType", value, {
                            shouldDirty: true,
                          })
                        }
                        className={`rounded-md px-2 py-3 text-[10px] font-semibold ${type === value ? "bg-[#8d4b00] text-white" : "bg-white"}`}
                      >
                        {value.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Label className="gv-label">
                      Content title
                      <Input {...form.register("title")} />
                      <FormError
                        message={form.formState.errors.title?.message}
                      />
                    </Label>
                    <Label className="gv-label">
                      URL slug
                      <Input
                        placeholder="Generated from title"
                        {...form.register("slug", {
                          setValueAs: (v) => v || undefined,
                        })}
                      />
                    </Label>
                  </div>
                  <Label className="gv-label">
                    Short logline / synopsis
                    <Textarea rows={3} {...form.register("shortDescription")} />
                    <FormError
                      message={form.formState.errors.shortDescription?.message}
                    />
                  </Label>
                  <Label className="gv-label">
                    Full description
                    <Textarea rows={6} {...form.register("description")} />
                    <FormError
                      message={form.formState.errors.description?.message}
                    />
                  </Label>
                  <Label className="gv-label">
                    Tagline
                    <Input {...form.register("tagline")} />
                  </Label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Label className="gv-label">
                      Release year
                      <Input
                        type="number"
                        min="1890"
                        max="2100"
                        {...form.register("releaseYear", {
                          setValueAs: toOptionalNumber,
                        })}
                      />
                    </Label>
                    <Label className="gv-label">
                      Country
                      <Input {...form.register("country")} />
                    </Label>
                    {type !== "SERIES" ? (
                      <Label className="gv-label">
                        Runtime (minutes)
                        <Input
                          type="number"
                          min="1"
                          {...form.register("runtimeMinutes", {
                            setValueAs: toOptionalNumber,
                          })}
                        />
                      </Label>
                    ) : (
                      <Label className="gv-label">
                        Series status
                        <Input {...form.register("seriesStatus")} />
                      </Label>
                    )}
                  </div>
                </section>
                <section
                  hidden={active !== "overview"}
                  id="panel-metadata"
                  role="tabpanel"
                  aria-labelledby="tab-overview"
                  className="space-y-5"
                >
                  <h2 className="text-xl font-bold text-primary">
                    Classification & Metadata
                  </h2>
                  <Label className="gv-label">
                    Audience classification
                    <FormSelect
                      aria-label="Audience classification"
                      control={form.control}
                      name="classification"
                    >
                      <SelectItem value="">Not assigned</SelectItem>
                      {options.classifications.map((item) => (
                        <SelectItem key={item.id} value={item.name}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </Label>
                  <div>
                    <p className="gv-label mb-3">Genres</p>
                    <div className="flex flex-wrap gap-4">
                      {options.genres.map((item) => (
                        <Label
                          className="flex items-center gap-2 text-xs"
                          key={item.id}
                        >
                          <FormCheckbox
                            value={item.id}
                            control={form.control}
                            name="genreIds"
                          />
                          {item.name}
                        </Label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="gv-label mb-3">Languages</p>
                    <div className="flex flex-wrap gap-4">
                      {options.languages.map((item) => (
                        <Label
                          className="flex items-center gap-2 text-xs"
                          key={item.id}
                        >
                          <FormCheckbox
                            value={item.id}
                            control={form.control}
                            name="languageIds"
                          />
                          {item.name}
                        </Label>
                      ))}
                    </div>
                  </div>
                </section>
                <section
                  hidden={active !== "people"}
                  id="panel-people"
                  role="tabpanel"
                  aria-labelledby="tab-people"
                  className="space-y-5"
                >
                  <h2 className="text-xl font-bold text-primary">
                    Creative Leadership
                  </h2>
                  <Label className="gv-label">
                    Production company
                    <FormSelect
                      aria-label="Production company"
                      control={form.control}
                      name="productionCompanyId"
                    >
                      <SelectItem value="">Not assigned</SelectItem>
                      {options.companies.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </Label>
                  <p className="text-xs text-slate-600">
                    Manage external creators in the Creators section, then
                    assign credits here.
                  </p>
                  {credits.fields.map((credit, index) => (
                    <div
                      key={credit.id}
                      className="grid gap-3 rounded-lg bg-white p-4 md:grid-cols-2"
                    >
                      <Label className="gv-label">
                        Person
                        <FormSelect
                          aria-label="Person"
                          control={form.control}
                          name={`credits.${index}.personId`}
                        >
                          <SelectItem value="">Choose creator</SelectItem>
                          {options.people.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name}
                            </SelectItem>
                          ))}
                        </FormSelect>
                      </Label>
                      <Label className="gv-label">
                        Credit
                        <FormSelect
                          aria-label="Credit"
                          control={form.control}
                          name={`credits.${index}.creditType`}
                        >
                          {Object.values(CreditType).map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </FormSelect>
                      </Label>
                      <Label className="gv-label">
                        Character / credit description
                        <Input
                          {...form.register(`credits.${index}.characterName`)}
                        />
                      </Label>
                      <button
                        type="button"
                        className="text-xs text-red-700"
                        onClick={() => credits.remove(index)}
                      >
                        Remove credit
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="gv-action secondary"
                    onClick={() =>
                      credits.append({
                        personId: "",
                        creditType: "CREATOR",
                        characterName: null,
                      })
                    }
                  >
                    ＋ Add Contributor
                  </button>
                </section>
                <section
                  hidden={active !== "people"}
                  id="panel-rights"
                  role="tabpanel"
                  aria-labelledby="tab-people"
                  className="space-y-5"
                >
                  <h2 className="text-xl font-bold text-primary">
                    Rights & Licensing
                  </h2>
                  <Label className="gv-label">
                    Rights holder
                    <FormSelect
                      aria-label="Rights holder"
                      control={form.control}
                      name="rightsHolderId"
                      disabled={scope === "creator" && Boolean(record)}
                    >
                      <SelectItem value="">Not assigned</SelectItem>
                      {options.rightsHolders.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                          {item.memberships?.length
                            ? ` — ${item.memberships.map((m) => m.user.name).join(", ")}`
                            : scope === "admin"
                              ? " (no linked account)"
                              : ""}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </Label>
                  <Label className="gv-label">
                    Media rights
                    <FormSelect
                      aria-label="Media rights"
                      control={form.control}
                      name="mediaRights"
                    >
                      {Object.values(MediaRights).map((right) => (
                        <SelectItem key={right} value={right}>
                          {right}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </Label>
                  <Label className="gv-label">
                    Private attribution / rights notes
                    <Textarea rows={5} {...form.register("attributionNotes")} />
                  </Label>
                </section>
                <section
                  hidden={active !== "publishing"}
                  id="panel-publishing"
                  role="tabpanel"
                  aria-labelledby="tab-publishing"
                  className="space-y-5"
                >
                  <h2 className="text-xl font-bold text-primary">
                    Publication Readiness
                  </h2>
                  {scope === "admin" ? (
                    <SettingRow
                      title="Premium Pass required"
                      description="An approved licence and private video are needed to publish this premium title."
                      icon="workspace_premium"
                    >
                      {({ labelId, descriptionId }) => (
                        <FormSwitch
                          control={form.control}
                          name="isPremium"
                          aria-labelledby={labelId}
                          aria-describedby={descriptionId}
                        />
                      )}
                    </SettingRow>
                  ) : null}
                  {scope === "admin" ? (
                    <SettingRow
                      title="Feature in catalogue"
                      description="Highlight this title as featured in the catalogue."
                      icon="star"
                    >
                      {({ labelId, descriptionId }) => (
                        <FormSwitch
                          control={form.control}
                          name="isFeatured"
                          aria-labelledby={labelId}
                          aria-describedby={descriptionId}
                        />
                      )}
                    </SettingRow>
                  ) : null}
                  <p className="text-xs leading-6 text-slate-600">
                    Publication uses saved data. Playback is optional; viewers
                    can discover catalogue-only entries.
                  </p>
                  <p className="text-sm font-semibold">
                    Playback:{" "}
                    {record
                      ? record.contentType === "SERIES"
                        ? `${record.seasons.flatMap((s) => s.episodes).filter((e) => selectPlaybackAsset(e.videoAssets)).length} episodes ready`
                        : selectPlaybackAsset(record.videoAssets)
                          ? "Ready"
                          : "No enabled source"
                      : "Save the title first"}
                  </p>
                  {issues.length ? (
                    <ul className="list-inside list-disc space-y-2 text-xs text-amber-900">
                      {issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm font-semibold text-green-800">
                      Saved metadata is ready for publication.
                    </p>
                  )}
                </section>
              </div>
              <aside
                className="gv-panel space-y-6"
                hidden={active !== "artwork"}
                id="panel-artwork"
                role="tabpanel"
                aria-labelledby="tab-artwork"
              >
                <h2 className="text-xl font-bold text-primary">Key Artwork</h2>
                <FileUpload
                  label="Cinematic backdrop (16:9)"
                  purpose="backdrop"
                  contentId={record?.id}
                  value={backdropUrl}
                  disabled={published || (scope === "creator" && !record)}
                  onFilesUploaded={(asset) =>
                    form.setValue("backdropUrl", asset?.secureUrl ?? null, {
                      shouldDirty: true,
                    })
                  }
                />
                <FileUpload
                  label="Vertical poster (2:3)"
                  purpose="poster"
                  contentId={record?.id}
                  value={posterUrl}
                  disabled={published || (scope === "creator" && !record)}
                  onFilesUploaded={(asset) =>
                    form.setValue("posterUrl", asset?.secureUrl ?? null, {
                      shouldDirty: true,
                    })
                  }
                />
              </aside>
            </div>
          </fieldset>
        </form>
      </FormProvider>
      {record ? (
        <div hidden={active !== "episodes" && active !== "video"}>
          <SeriesMediaContent
            record={record}
            disabled={published || dirty}
            section={active === "episodes" ? "episodes" : "video"}
          />
        </div>
      ) : (
        <div className="gv-panel mt-6 text-sm">
          Save the draft to manage trailers, seasons, episodes, and playback
          links.
        </div>
      )}
      {record && !published ? (
        <div className="mt-8">
          <button
            className="text-xs font-semibold text-red-700"
            onClick={() => {
              if (
                confirm(`Permanently delete ${record.title} and its seasons?`)
              )
                mutation.mutate(
                  { path: `content/${record.id}`, method: "DELETE" },
                  {
                    onSuccess: () => router.push(`/${scope}/content`),
                    onError: (e) => toast.error(e.message),
                  }
                )
            }}
          >
            Delete title
          </button>
        </div>
      ) : null}
    </>
  )
}
function EditorLoader({ id }: { id: string }) {
  const options = useAdminOptions()
  const query = useAdminContentRecord(id)
  const pending = options.isPending || (id !== "new" && query.isPending)
  const error = options.error ?? (id !== "new" ? query.error : null)
  if (pending || error)
    return (
      <QueryState
        pending={pending}
        error={error}
        retry={() => {
          void options.refetch()
          if (id !== "new") void query.refetch()
        }}
      />
    )
  return options.data ? (
    <EditorForm
      key={id}
      options={options.data}
      record={id === "new" ? undefined : query.data}
    />
  ) : null
}
export function ContentEditorContent({
  id,
  scope = "admin",
}: {
  id: string
  scope?: "admin" | "creator"
}) {
  return (
    <ContentScope value={scope}>
      <EditorLoader id={id} />
    </ContentScope>
  )
}
