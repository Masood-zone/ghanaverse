"use client"
import {
  FormSelect,
  FormSwitch,
  FormCheckbox,
} from "@/components/ui/form-controls"
import { SettingRow } from "@/components/ui/setting-row"
import { SelectField } from "@/components/ui/select-field"
import { SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAdminUsers } from "@/services/admin/users"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { userUpdateSchema } from "@/lib/validation/admin"
import type { z } from "zod"
import { useAdminMutation, useAdminResource } from "@/services/admin/queries"
import type { AdminUser, AdminOptions, Option } from "@/types/admin"
import { RightsHolderUserForm } from "./rights-holder-user-form"
import {
  Heading,
  Metric,
  QueryState,
  Pager,
  Status,
  Empty,
  FormError,
} from "./shared"
function UserForm({
  user,
  holders,
  close,
}: {
  user: AdminUser
  holders: Option[]
  close: () => void
}) {
  const form = useForm<
    z.input<typeof userUpdateSchema>,
    unknown,
    z.output<typeof userUpdateSchema>
  >({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      role: user.role,
      isSuspended: user.isSuspended,
      rightsHolderIds: user.rightsHolderMemberships.map(
        (m) => m.rightsHolderId
      ),
    },
  })
  const selectedRole = useWatch({ control: form.control, name: "role" })
  const mutation = useAdminMutation()
  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        if (
          confirm(
            `Update access for ${user.name}? Existing sessions will be revoked.`
          )
        )
          mutation.mutate(
            { path: `users/${user.id}`, method: "PATCH", body: values },
            {
              onSuccess: () => {
                toast.success("User access updated")
                close()
              },
              onError: (e) => toast.error(e.message),
            }
          )
      })}
      className="gv-panel my-5 space-y-4"
    >
      <h2 className="font-bold">Manage {user.name}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <Label className="gv-label">
          Role
          <FormSelect aria-label="Role" control={form.control} name="role">
            <SelectItem value="VIEWER">VIEWER</SelectItem>
            <SelectItem value="RIGHTS_HOLDER">RIGHTS_HOLDER</SelectItem>
            <SelectItem value="ADMIN">ADMIN</SelectItem>
          </FormSelect>
        </Label>
        <SettingRow
          title="Suspend account"
          description="Block this user's access while the account is suspended."
          icon="person_off"
          className="w-full sm:flex-1"
        >
          {({ labelId, descriptionId }) => (
            <FormSwitch
              control={form.control}
              name="isSuspended"
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
            />
          )}
        </SettingRow>
      </div>
      {selectedRole === "RIGHTS_HOLDER" ? (
        <fieldset className="space-y-2">
          <legend className="gv-label mb-2">Rights-holder organizations</legend>
          {holders.map((holder) => (
            <Label key={holder.id} className="flex items-center gap-2 text-sm">
              <FormCheckbox
                value={holder.id}
                control={form.control}
                name="rightsHolderIds"
              />
              {holder.name}
            </Label>
          ))}
          <FormError message={form.formState.errors.rightsHolderIds?.message} />
        </fieldset>
      ) : null}
      <FormError message={mutation.error?.message} />
      <div className="flex gap-2">
        <button className="gv-action" disabled={mutation.isPending}>
          Save access
        </button>
        <button type="button" className="gv-action secondary" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  )
}
export function UsersContent() {
  const [q, setQ] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [creating, setCreating] = useState(false)
  const options = useAdminResource<AdminOptions>("options")
  const query = useAdminUsers(
    `${new URLSearchParams({ q, role, status, page: String(page) })}`
  )
  return (
    <>
      <Heading
        eyebrow="Account operations & access management"
        title="Users"
        description="Manage viewers, rights holders, and administrators. Access changes revoke existing sessions."
      />
      <button
        className="gv-action mb-5"
        onClick={() => {
          setCreating(true)
          setEditing(null)
        }}
        disabled={!options.data}
      >
        Create rights holder
      </button>
      {creating && options.data ? (
        <RightsHolderUserForm
          holders={options.data.rightsHolders}
          close={() => setCreating(false)}
        />
      ) : null}
      <QueryState
        pending={false}
        error={options.error}
        retry={options.refetch}
      />
      {query.data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Rights-holder accounts"
            value={query.data.rightsHolders}
            icon="verified_user"
          />
          <Metric
            label="Registered viewers"
            value={query.data.viewers}
            icon="group"
          />
          <Metric
            label="Active administrators"
            value={query.data.admins}
            icon="admin_panel_settings"
          />
          <Metric
            label="Suspended accounts"
            value={query.data.suspended}
            icon="person_off"
          />
        </div>
      ) : null}
      <div className="gv-panel mb-5 grid gap-3 sm:grid-cols-3">
        <Input
          aria-label="Search users"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <SelectField
          aria-label="Filter role"
          value={role}
          onValueChange={(e) => {
            setRole(e)
            setPage(1)
          }}
        >
          <SelectItem value="">All roles</SelectItem>
          <SelectItem value="ADMIN">ADMIN</SelectItem>
          <SelectItem value="VIEWER">VIEWER</SelectItem>
          <SelectItem value="RIGHTS_HOLDER">RIGHTS_HOLDER</SelectItem>
        </SelectField>
        <SelectField
          aria-label="Account status"
          value={status}
          onValueChange={(e) => {
            setStatus(e)
            setPage(1)
          }}
        >
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectField>
      </div>
      {editing ? (
        <UserForm
          key={editing.id}
          user={editing}
          holders={options.data?.rightsHolders ?? []}
          close={() => setEditing(null)}
        />
      ) : null}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data ? (
        <div className="overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="gv-table min-w-[700px]">
              <thead>
                <tr>
                  {[
                    "Account name",
                    "Email address",
                    "Role",
                    "Account status",
                    "Profiles",
                    "Joined",
                    "Actions",
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="font-semibold">{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <Status value={user.role} />
                    </td>
                    <td>
                      <Status
                        value={user.isSuspended ? "Suspended" : "Active"}
                      />
                    </td>
                    <td>{user._count.profiles}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="font-semibold text-primary"
                        onClick={() => setEditing(user)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length ? (
            <Empty>No users match these filters.</Empty>
          ) : null}
          <Pager {...query.data} onPage={setPage} />
        </div>
      ) : null}
    </>
  )
}
