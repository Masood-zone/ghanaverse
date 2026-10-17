"use client"
import {
  RouteSkeleton,
  type RouteSkeletonKind,
} from "@/components/common/route-skeleton"
export function QueryState({
  pending,
  error,
  retry,
  label = "Loading data",
  kind = "workspace",
}: {
  pending: boolean
  error: Error | null
  retry: () => unknown
  label?: string
  kind?: RouteSkeletonKind
}) {
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6"
      >
        <p>{error.message}</p>
        <button className="gv-action mt-4" onClick={() => retry()}>
          Try again
        </button>
      </div>
    )
  if (pending)
    return (
      <div aria-label={label}>
        <RouteSkeleton kind={kind} />
      </div>
    )
  return null
}
