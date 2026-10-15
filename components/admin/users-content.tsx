"use client"
import { useAdminUsers } from "@/services/admin/users"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { userUpdateSchema } from "@/lib/validation/admin"
import type { z } from "zod"
import { useAdminMutation } from "@/services/admin/queries"
import type { AdminUser } from "@/types/admin"
import {
  Heading,
  Metric,
  QueryState,
  Pager,
  Status,
  Empty,
  FormError,
} from "./shared"
function UserForm({ user, close }: { user: AdminUser; close: () => void }) {
  const form = useForm<z.infer<typeof userUpdateSchema>>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: { role: user.role, isSuspended: user.isSuspended },
  })
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
        <label className="gv-label">
          Role
          <select aria-label="Role" className="gv-field" {...form.register("role")}>
            <option>VIEWER</option>
            <option>ADMIN</option>
          </select>
        </label>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" {...form.register("isSuspended")} />
          Suspend account
        </label>
      </div>
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
  const query = useAdminUsers(
    `${new URLSearchParams({ q, role, status, page: String(page) })}`
  )
  return (
    <>
      <Heading
        eyebrow="Account operations & access management"
        title="Users"
        description="Manage registered viewers and administrator access. Role and suspension changes revoke existing sessions."
      />
      {query.data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
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
        <input
          aria-label="Search users"
          className="gv-field"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <select
          aria-label="Filter role"
          className="gv-field"
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All roles</option>
          <option>ADMIN</option>
          <option>VIEWER</option>
        </select>
        <select
          aria-label="Account status"
          className="gv-field"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      {editing ? (
        <UserForm
          key={editing.id}
          user={editing}
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
                    "Viewer name",
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
