"use client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAdminOptions } from "@/services/admin/metadata"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import FileUpload from "@/components/common/FileUpload"
import { useAdminMutation } from "@/services/admin/queries"
import type { Option } from "@/types/admin"
import { slugify } from "@/lib/platform-validation"
import { Heading, QueryState, Empty, FormError } from "./shared"
const kinds = [
  ["genres", "Genres"],
  ["languages", "Languages"],
  ["classifications", "Classifications"],
  ["companies", "Production Companies"],
  ["rightsHolders", "Rights Holders"],
  ["people", "People & Creators"],
] as const
type Kind = (typeof kinds)[number][0]
const paths = {
  genres: "genres",
  languages: "languages",
  classifications: "classifications",
  companies: "production-companies",
  rightsHolders: "rights-holders",
  people: "creators",
}
const formSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(180),
  slug: z.string().max(120),
  code: z.string().max(12),
  contactEmail: z.union([z.email(), z.literal("")]),
  notes: z.string().max(2000),
  imageUrl: z.string(),
  phone: z.string().max(60),
  address: z.string().max(500),
  website: z.url().or(z.literal("")),
})
type Values = z.infer<typeof formSchema>
function RegistryForm({
  kind,
  record,
  close,
}: {
  kind: Kind
  record: Option | null
  close: () => void
}) {
  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: record?.name ?? "",
      slug: record?.slug ?? "",
      code: record?.code ?? "",
      contactEmail: record?.contactEmail ?? "",
      notes: record?.notes ?? "",
      imageUrl: record?.imageUrl ?? "",
      phone: record?.phone ?? "",
      address: record?.address ?? "",
      website: record?.website ?? "",
    },
  })
  const imageUrl = useWatch({ control: form.control, name: "imageUrl" })
  const mutation = useAdminMutation()
  return (
    <form
      className="gv-panel my-5 space-y-4"
      onSubmit={form.handleSubmit((values) => {
        const body: Record<string, string | null> = { name: values.name }
        if (["genres", "classifications"].includes(kind))
          body.slug = values.slug || slugify(values.name)
        if (kind === "languages") body.code = values.code
        if (kind === "rightsHolders") {
          body.contactEmail = values.contactEmail
          body.notes = values.notes
          body.phone = values.phone
          body.address = values.address
          body.website = values.website
        }
        if (kind === "people") body.imageUrl = values.imageUrl || null
        mutation.mutate(
          {
            path:
              kind === "people"
                ? `creators${record ? "/" + record.id : ""}`
                : `metadata/${paths[kind]}${record ? "/" + record.id : ""}`,
            method: record ? "PATCH" : "POST",
            body,
          },
          {
            onSuccess: () => {
              toast.success("Record saved")
              close()
            },
            onError: (e) => toast.error(e.message),
          }
        )
      })}
    >
      <h2 className="text-xl font-bold">
        {record ? "Edit" : "Add"} {kinds.find((k) => k[0] === kind)?.[1]} Record
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Label className="gv-label">
          Name
          <Input {...form.register("name")} />
          <FormError message={form.formState.errors.name?.message} />
        </Label>
        {["genres", "classifications"].includes(kind) ? (
          <Label className="gv-label">
            URL slug
            <Input
              placeholder="Generated from name if blank"
              {...form.register("slug")}
            />
          </Label>
        ) : null}
        {kind === "languages" ? (
          <Label className="gv-label">
            Language code
            <Input required {...form.register("code")} />
          </Label>
        ) : null}
        {kind === "rightsHolders" ? (
          <>
            <Label className="gv-label">
              Contact email
              <Input type="email" {...form.register("contactEmail")} />
              <FormError
                message={form.formState.errors.contactEmail?.message}
              />
            </Label>
            <Label className="gv-label md:col-span-2">
              Administrative notes
              <Textarea rows={3} {...form.register("notes")} />
            </Label>
            <Label className="gv-label">
              Phone
              <Input type="tel" {...form.register("phone")} />
            </Label>
            <Label className="gv-label">
              Website
              <Input type="url" {...form.register("website")} />
              <FormError message={form.formState.errors.website?.message} />
            </Label>
            <Label className="gv-label md:col-span-2">
              Address
              <Input {...form.register("address")} />
            </Label>
          </>
        ) : null}
        {kind === "people" ? (
          <FileUpload
            label="Creator portrait"
            purpose="creatorPortrait"
            value={imageUrl}
            onFilesUploaded={(asset) =>
              form.setValue("imageUrl", asset?.secureUrl ?? "", {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        ) : null}
      </div>
      <FormError message={mutation.error?.message} />
      <div className="flex gap-3">
        <button className="gv-action" disabled={mutation.isPending}>
          Save record
        </button>
        <button
          type="button"
          className="gv-action secondary"
          onClick={() => {
            if (!form.formState.isDirty || confirm("Discard unsaved changes?"))
              close()
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
export function RegistryContent({ creators = false }: { creators?: boolean }) {
  const query = useAdminOptions()
  const [kind, setKind] = useState<Kind>(creators ? "people" : "genres")
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<Option | null | undefined>()
  const mutation = useAdminMutation()
  const items =
    query.data?.[kind].filter((item) =>
      item.name.toLowerCase().includes(q.toLowerCase())
    ) ?? []
  return (
    <>
      <Heading
        eyebrow={
          creators
            ? "Creative leadership & attribution"
            : "Taxonomy & legal registry"
        }
        title={
          creators ? "Creators & Production" : "Metadata & Rights Management"
        }
        description={
          creators
            ? "Register external creators and credit them on titles. Creator records do not grant access to the application."
            : "Manage platform genres, languages, classifications, production companies, and administrative rights-holder records."
        }
        actions={
          <button className="gv-action" onClick={() => setEditing(null)}>
            ＋ Add Record
          </button>
        }
      />
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#dfe9fc] p-2">
        {kinds
          .filter(([key]) =>
            creators ? ["people", "companies"].includes(key) : key !== "people"
          )
          .map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setKind(key)
                setQ("")
                setEditing(undefined)
              }}
              className={`rounded-md px-4 py-3 text-xs font-bold whitespace-nowrap ${key === kind ? "bg-white text-primary shadow-sm" : "text-slate-600"}`}
            >
              {label}{" "}
              <span className="ml-2 text-[10px]">
                {query.data?.[key].length ?? 0}
              </span>
            </button>
          ))}
      </div>
      <div className="gv-panel mt-6">
        <h2 className="text-lg font-bold">
          {kind === "rightsHolders"
            ? "Administrative Rights Records"
            : kinds.find((k) => k[0] === kind)?.[1]}
        </h2>
        <p className="mt-2 text-xs leading-6 text-slate-600">
          {kind === "rightsHolders"
            ? "Rights holders are registered entities for attribution and administrative records. Their details remain private to administrators."
            : ""}
        </p>
      </div>
      {editing !== undefined ? (
        <RegistryForm
          key={`${kind}-${editing?.id ?? "new"}`}
          kind={kind}
          record={editing}
          close={() => setEditing(undefined)}
        />
      ) : null}
      <Input
        className="my-5 max-w-lg"
        aria-label="Search records"
        placeholder="Search records by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data ? (
        <div className="overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="gv-table">
              <thead>
                <tr>
                  <th>Name / Entity</th>
                  <th>
                    {kind === "languages"
                      ? "Code"
                      : kind === "rightsHolders"
                        ? "Contact"
                        : "Identifier"}
                  </th>
                  <th>Linked titles / Credits</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold text-primary">{item.name}</td>
                    <td className="text-xs">
                      {item.code ?? item.contactEmail ?? item.slug ?? item.id}
                    </td>
                    <td>
                      {item._count?.contents ?? item._count?.credits ?? 0}
                    </td>
                    <td>
                      <div className="flex gap-4">
                        <button
                          className="text-xs font-semibold text-primary"
                          onClick={() => setEditing(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs font-semibold text-red-700"
                          disabled={mutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete ${item.name}? Referenced records cannot be deleted.`
                              )
                            )
                              mutation.mutate(
                                {
                                  path:
                                    kind === "people"
                                      ? `creators/${item.id}`
                                      : `metadata/${paths[kind]}/${item.id}`,
                                  method: "DELETE",
                                },
                                {
                                  onSuccess: () =>
                                    toast.success("Record deleted"),
                                  onError: (e) => toast.error(e.message),
                                }
                              )
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!items.length ? (
            <Empty>No records match this search. Add a record to begin.</Empty>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
