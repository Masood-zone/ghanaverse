"use client"
import { useAdminOptions } from "@/services/admin/metadata"
import { useAdminContentRecord } from "@/services/admin/content"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  ["general", "General"],
  ["metadata", "Classification & Meta"],
  ["people", "People & Production"],
  ["rights", "Rights"],
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
  const [active, setActive] = useState<(typeof tabs)[number][0]>("general")
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
          publicationStatus: record?.publicationStatus ?? "DRAFT",
        },
      })
      form.reset({
        ...form.getValues(),
        slug: form.getValues("slug") || undefined,
      })
      toast.success("Title saved")
      if (!record) router.replace(`/admin/content/${saved.id}`)
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="text-xs font-semibold text-primary"
          href="/admin/content"
        >
          ← Back to Content Library
        </Link>
        <div className="flex flex-wrap gap-2">
          {record ? (
            <>
              <Link
                className="gv-action secondary"
                href={`/admin/content/${record.id}/preview`}
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
        <form id="content-editor" noValidate onSubmit={form.handleSubmit(save)}>
          <div
            role="tablist"
            aria-label="Content sections"
            className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-white p-2"
          >
            {tabs.map(([id, label]) => (
              <button
                key={id}
                id={`tab-${id}`}
                aria-controls={`panel-${id}`}
                aria-selected={active === id}
                role="tab"
                tabIndex={active === id ? 0 : -1}
                type="button"
                onKeyDown={(event) => {
                  const index = tabs.findIndex((tab) => tab[0] === id)
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : -1
                  if (next >= 0) {
                    event.preventDefault()
                    setActive(tabs[next][0])
                    document.getElementById(`tab-${tabs[next][0]}`)?.focus()
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
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="gv-panel space-y-5">
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
                  hidden={active !== "general"}
                  id="panel-general"
                  role="tabpanel"
                  aria-labelledby="tab-general"
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
                    <label className="gv-label">
                      Content title
                      <input className="gv-field" {...form.register("title")} />
                      <FormError
                        message={form.formState.errors.title?.message}
                      />
                    </label>
                    <label className="gv-label">
                      URL slug
                      <input
                        className="gv-field"
                        placeholder="Generated from title"
                        {...form.register("slug", {
                          setValueAs: (v) => v || undefined,
                        })}
                      />
                    </label>
                  </div>
                  <label className="gv-label">
                    Short logline / synopsis
                    <textarea
                      rows={3}
                      className="gv-field"
                      {...form.register("shortDescription")}
                    />
                    <FormError
                      message={form.formState.errors.shortDescription?.message}
                    />
                  </label>
                  <label className="gv-label">
                    Full description
                    <textarea
                      rows={6}
                      className="gv-field"
                      {...form.register("description")}
                    />
                    <FormError
                      message={form.formState.errors.description?.message}
                    />
                  </label>
                  <label className="gv-label">
                    Tagline
                    <input className="gv-field" {...form.register("tagline")} />
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="gv-label">
                      Release year
                      <input
                        type="number"
                        min="1890"
                        max="2100"
                        className="gv-field"
                        {...form.register("releaseYear", {
                          setValueAs: toOptionalNumber,
                        })}
                      />
                    </label>
                    <label className="gv-label">
                      Country
                      <input
                        className="gv-field"
                        {...form.register("country")}
                      />
                    </label>
                    {type !== "SERIES" ? (
                      <label className="gv-label">
                        Runtime (minutes)
                        <input
                          type="number"
                          min="1"
                          className="gv-field"
                          {...form.register("runtimeMinutes", {
                            setValueAs: toOptionalNumber,
                          })}
                        />
                      </label>
                    ) : (
                      <label className="gv-label">
                        Series status
                        <input
                          className="gv-field"
                          {...form.register("seriesStatus")}
                        />
                      </label>
                    )}
                  </div>
                </section>
                <section
                  hidden={active !== "metadata"}
                  id="panel-metadata"
                  role="tabpanel"
                  aria-labelledby="tab-metadata"
                  className="space-y-5"
                >
                  <h2 className="text-xl font-bold text-primary">
                    Classification & Metadata
                  </h2>
                  <label className="gv-label">
                    Audience classification
                    <select
                      aria-label="Audience classification"
                      className="gv-field"
                      {...form.register("classification")}
                    >
                      <option value="">Not assigned</option>
                      {options.classifications.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="gv-label mb-3">Genres</p>
                    <div className="flex flex-wrap gap-4">
                      {options.genres.map((item) => (
                        <label
                          className="flex items-center gap-2 text-xs"
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            value={item.id}
                            {...form.register("genreIds")}
                          />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="gv-label mb-3">Languages</p>
                    <div className="flex flex-wrap gap-4">
                      {options.languages.map((item) => (
                        <label
                          className="flex items-center gap-2 text-xs"
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            value={item.id}
                            {...form.register("languageIds")}
                          />
                          {item.name}
                        </label>
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
                  <label className="gv-label">
                    Production company
                    <select
                      aria-label="Production company"
                      className="gv-field"
                      {...form.register("productionCompanyId")}
                    >
                      <option value="">Not assigned</option>
                      {options.companies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-slate-600">
                    Manage external creators in the Creators section, then
                    assign credits here.
                  </p>
                  {credits.fields.map((credit, index) => (
                    <div
                      key={credit.id}
                      className="grid gap-3 rounded-lg bg-white p-4 md:grid-cols-2"
                    >
                      <label className="gv-label">
                        Person
                        <select
                          aria-label="Person"
                          className="gv-field"
                          {...form.register(`credits.${index}.personId`)}
                        >
                          <option value="">Choose creator</option>
                          {options.people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="gv-label">
                        Credit
                        <select
                          aria-label="Credit"
                          className="gv-field"
                          {...form.register(`credits.${index}.creditType`)}
                        >
                          {Object.values(CreditType).map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                      </label>
                      <label className="gv-label">
                        Character / credit description
                        <input
                          className="gv-field"
                          {...form.register(`credits.${index}.characterName`)}
                        />
                      </label>
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
                  hidden={active !== "rights"}
                  id="panel-rights"
                  role="tabpanel"
                  aria-labelledby="tab-rights"
                  className="space-y-5"
                >
                  <h2 className="text-xl font-bold text-primary">
                    Rights & Licensing
                  </h2>
                  <label className="gv-label">
                    Rights holder
                    <select
                      aria-label="Rights holder"
                      className="gv-field"
                      {...form.register("rightsHolderId")}
                    >
                      <option value="">Not assigned</option>
                      {options.rightsHolders.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="gv-label">
                    Media rights
                    <select
                      aria-label="Media rights"
                      className="gv-field"
                      {...form.register("mediaRights")}
                    >
                      {Object.values(MediaRights).map((right) => (
                        <option key={right}>{right}</option>
                      ))}
                    </select>
                  </label>
                  <label className="gv-label">
                    Private attribution / rights notes
                    <textarea
                      rows={5}
                      className="gv-field"
                      {...form.register("attributionNotes")}
                    />
                  </label>
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
                  <label className="flex gap-2 text-sm">
                    <input type="checkbox" {...form.register("isFeatured")} />
                    Feature this title in the catalogue
                  </label>
                  <p className="text-xs leading-6 text-slate-600">
                    Publication uses saved data. Playback is optional; viewers
                    can discover catalogue-only entries.
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
              <aside className="gv-panel space-y-6">
                <h2 className="text-xl font-bold text-primary">Key Artwork</h2>
                <FileUpload
                  label="Cinematic backdrop (16:9)"
                  purpose="backdrop"
                  value={backdropUrl}
                  disabled={published}
                  onFilesUploaded={(asset) =>
                    form.setValue("backdropUrl", asset?.secureUrl ?? null, {
                      shouldDirty: true,
                    })
                  }
                />
                <FileUpload
                  label="Vertical poster (2:3)"
                  purpose="poster"
                  value={posterUrl}
                  disabled={published}
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
        <SeriesMediaContent record={record} disabled={published} />
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
                    onSuccess: () => router.push("/admin/content"),
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
export function ContentEditorContent({ id }: { id: string }) {
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
