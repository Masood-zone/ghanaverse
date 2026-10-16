"use client"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { useAdminMutation } from "@/services/admin/queries"
import type { Option } from "@/types/admin"
import { FormError } from "./shared"
type Values = {
  name: string
  email: string
  password: string
  confirmPassword: string
  rightsHolderId: string
  businessName: string
  phone: string
  address: string
  website: string
  notes: string
}
export function RightsHolderUserForm({
  holders,
  close,
}: {
  holders: Option[]
  close: () => void
}) {
  const form = useForm<Values>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      rightsHolderId: "",
      businessName: "",
      phone: "",
      address: "",
      website: "",
      notes: "",
    },
  })
  const selected = useWatch({ control: form.control, name: "rightsHolderId" })
  const mutation = useAdminMutation()
  return (
    <form
      className="gv-panel my-5 grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit((values) => {
        if (values.password !== values.confirmPassword) {
          form.setError("confirmPassword", {
            message: "Passwords do not match",
          })
          return
        }
        mutation.mutate(
          {
            path: "users",
            body: {
              name: values.name,
              email: values.email,
              password: values.password,
              ...(values.rightsHolderId
                ? { rightsHolderId: values.rightsHolderId }
                : {
                    rightsHolder: {
                      name: values.businessName,
                      contactEmail: values.email,
                      phone: values.phone,
                      address: values.address,
                      website: values.website,
                      notes: values.notes,
                    },
                  }),
            },
          },
          {
            onSuccess: () => {
              form.reset()
              toast.success(
                "Rights-holder account created. Share the initial credentials directly."
              )
              close()
            },
          }
        )
      })}
    >
      <h2 className="font-bold sm:col-span-2">Create rights-holder account</h2>
      <label className="gv-label">
        Contact name
        <input
          className="gv-field"
          required
          maxLength={180}
          autoComplete="name"
          {...form.register("name")}
        />
      </label>
      <label className="gv-label">
        Login email
        <input
          className="gv-field"
          type="email"
          required
          autoComplete="off"
          {...form.register("email")}
        />
      </label>
      <label className="gv-label">
        Initial password
        <input
          className="gv-field"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          {...form.register("password")}
        />
      </label>
      <label className="gv-label">
        Confirm password
        <input
          className="gv-field"
          type="password"
          required
          autoComplete="new-password"
          {...form.register("confirmPassword")}
        />
        <FormError message={form.formState.errors.confirmPassword?.message} />
      </label>
      <label className="gv-label sm:col-span-2">
        Rights holder
        <select className="gv-field" {...form.register("rightsHolderId")}>
          <option value="">Create a new rights holder</option>
          {holders.map((holder) => (
            <option key={holder.id} value={holder.id}>
              {holder.name}
            </option>
          ))}
        </select>
      </label>
      {!selected ? (
        <>
          <label className="gv-label sm:col-span-2">
            Rights-holder / business name
            <input
              className="gv-field"
              required
              maxLength={180}
              {...form.register("businessName")}
            />
          </label>
          <label className="gv-label">
            Phone (optional)
            <input
              className="gv-field"
              type="tel"
              maxLength={60}
              {...form.register("phone")}
            />
          </label>
          <label className="gv-label">
            Website (optional)
            <input
              className="gv-field"
              type="url"
              {...form.register("website")}
            />
          </label>
          <label className="gv-label sm:col-span-2">
            Address (optional)
            <input
              className="gv-field"
              maxLength={500}
              {...form.register("address")}
            />
          </label>
          <label className="gv-label sm:col-span-2">
            Private notes (optional)
            <textarea
              className="gv-field"
              maxLength={2000}
              {...form.register("notes")}
            />
          </label>
        </>
      ) : null}
      <div className="sm:col-span-2">
        <FormError message={mutation.error?.message} />
        <div className="mt-3 flex gap-2">
          <button className="gv-action" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create rights holder"}
          </button>
          <button type="button" className="gv-action secondary" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
