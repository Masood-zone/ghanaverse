"use client"
import type { ReactNode } from "react"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
export function Heading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div>
        <p className="text-[10px] font-bold tracking-[.15em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-[36px] md:leading-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
  )
}
export { QueryState } from "@/components/common/query-state"
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap ${["PUBLISHED", "Active", "ADMIN"].includes(value) ? "bg-green-100 text-green-800" : ["DRAFT", "VIEWER", "RIGHTS_HOLDER"].includes(value) ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  )
}
export function Metric({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: string
}) {
  return (
    <div className="rounded-xl bg-[#eff3ff] p-5">
      <div className="flex justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase">
          {label}
        </p>
        <MaterialSymbol icon={icon} className="text-xl text-primary" />
      </div>
      <p className="mt-5 text-3xl font-extrabold">{value.toLocaleString()}</p>
    </div>
  )
}
export function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  onPage: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#e6eeff] p-4 text-xs">
      <span>
        {total} records · Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          className="gv-action secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="gv-action secondary"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-700">
      {message}
    </p>
  ) : null
}
