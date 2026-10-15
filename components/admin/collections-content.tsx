"use client"
import { useAdminContent } from "@/services/admin/content"
import { useAdminCollections } from "@/services/admin/collections"
import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { collectionSchema } from "@/lib/validation/admin"
import type { CollectionRecord } from "@/types/admin"
import { useAdminMutation } from "@/services/admin/queries"
import { Heading, QueryState, Empty, FormError } from "./shared"
const schema = collectionSchema.omit({ contentIds: true }).extend({
  selected: z
    .array(z.object({ contentId: z.string(), title: z.string() }))
    .max(100),
})
type Values = z.infer<typeof schema>
function CollectionForm({
  record,
  close,
}: {
  record: CollectionRecord | null
  close: () => void
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record?.name ?? "",
      slug: record?.slug ?? "",
      description: record?.description ?? "",
      sortOrder: record?.sortOrder ?? 0,
      isActive: record?.isActive ?? false,
      selected:
        record?.items.map((i) => ({
          contentId: i.contentId,
          title: i.content.title,
        })) ?? [],
    },
  })
  const fields = useFieldArray({ control: form.control, name: "selected" })
  const [q, setQ] = useState("")
  const titles = useAdminContent(`q=${encodeURIComponent(q)}`)
  const mutation = useAdminMutation()
  return (
    <form
      className="gv-panel mb-6 space-y-5"
      onSubmit={form.handleSubmit(({ selected, ...data }) =>
        mutation.mutate(
          {
            path: `collections${record ? "/" + record.id : ""}`,
            method: record ? "PATCH" : "POST",
            body: { ...data, contentIds: selected.map((i) => i.contentId) },
          },
          {
            onSuccess: () => {
              toast.success("Collection saved")
              close()
            },
            onError: (e) => toast.error(e.message),
          }
        )
      )}
    >
      <h2 className="text-xl font-bold">
        {record ? "Edit" : "Create"} Collection
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="gv-label">
          Name
          <input className="gv-field" {...form.register("name")} />
          <FormError message={form.formState.errors.name?.message} />
        </label>
        <label className="gv-label">
          Slug
          <input className="gv-field" {...form.register("slug")} />
          <FormError message={form.formState.errors.slug?.message} />
        </label>
        <label className="gv-label">
          Description
          <textarea className="gv-field" {...form.register("description")} />
        </label>
        <label className="gv-label">
          Display position
          <input
            type="number"
            min="0"
            className="gv-field"
            {...form.register("sortOrder", { valueAsNumber: true })}
          />
        </label>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" {...form.register("isActive")} />
          Show this collection publicly
        </label>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <h3 className="mb-3 font-bold">Find titles</h3>
          <input
            className="gv-field"
            aria-label="Search titles for collection"
            placeholder="Search catalogue…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {titles.data?.items.map((item) => (
              <button
                type="button"
                className="flex w-full justify-between rounded bg-white p-3 text-left text-xs"
                disabled={fields.fields.some((f) => f.contentId === item.id)}
                key={item.id}
                onClick={() =>
                  fields.append({ contentId: item.id, title: item.title })
                }
              >
                {item.title}
                <span>
                  {fields.fields.some((f) => f.contentId === item.id)
                    ? "Selected"
                    : "＋ Add"}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-3 font-bold">Collection order</h3>
          <div className="space-y-2">
            {fields.fields.map((item, index) => (
              <div
                className="flex items-center justify-between gap-3 rounded bg-white p-3 text-xs"
                key={item.id}
              >
                <span>
                  {index + 1}. {item.title}
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    aria-label={`Move ${item.title} up`}
                    disabled={index === 0}
                    onClick={() => fields.move(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.title} down`}
                    disabled={index === fields.fields.length - 1}
                    onClick={() => fields.move(index, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    className="text-red-700"
                    onClick={() => fields.remove(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!fields.fields.length ? <Empty>No titles selected.</Empty> : null}
          </div>
        </section>
      </div>
      <FormError message={mutation.error?.message} />
      <div className="flex gap-3">
        <button className="gv-action" disabled={mutation.isPending}>
          Save collection
        </button>
        <button
          type="button"
          className="gv-action secondary"
          onClick={() => {
            if (
              !form.formState.isDirty ||
              confirm("Discard collection changes?")
            )
              close()
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
export function CollectionsContent() {
  const query = useAdminCollections()
  const [editing, setEditing] = useState<CollectionRecord | null | undefined>()
  const mutation = useAdminMutation()
  return (
    <>
      <Heading
        eyebrow="Public catalogue curation"
        title="Collections"
        description="Organise and order public shelves using saved catalogue records. Only published titles appear to viewers."
        actions={
          <button className="gv-action" onClick={() => setEditing(null)}>
            ＋ Create collection
          </button>
        }
      />
      {editing !== undefined ? (
        <CollectionForm
          key={editing?.id ?? "new"}
          record={editing}
          close={() => setEditing(undefined)}
        />
      ) : null}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data ? (
        <div className="grid gap-5">
          {query.data.map((record) => (
            <div
              key={record.id}
              className="gv-panel flex flex-col justify-between gap-5 md:flex-row"
            >
              <div>
                <p className="text-[10px] font-bold text-primary uppercase">
                  Position {record.sortOrder} ·{" "}
                  {record.isActive ? "Active" : "Hidden"}
                </p>
                <h2 className="mt-2 text-xl font-bold">{record.name}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {record.description}
                </p>
                <p className="mt-2 text-xs">
                  {record.items.length} titles ·{" "}
                  {
                    record.items.filter(
                      (i) => i.content.publicationStatus === "PUBLISHED"
                    ).length
                  }{" "}
                  publicly available
                </p>
              </div>
              <div className="flex items-start gap-3">
                <button
                  className="gv-action secondary"
                  onClick={() => setEditing(record)}
                >
                  Edit & order
                </button>
                <button
                  className="gv-action danger"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `Delete collection ${record.name}? Titles will be preserved.`
                      )
                    )
                      mutation.mutate(
                        { path: `collections/${record.id}`, method: "DELETE" },
                        {
                          onSuccess: () => toast.success("Collection deleted"),
                          onError: (e) => toast.error(e.message),
                        }
                      )
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!query.data.length ? (
            <Empty>
              No collections yet. Create one to curate a public shelf.
            </Empty>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
