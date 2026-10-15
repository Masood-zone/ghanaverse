"use client"
export function QueryState({
  pending,
  error,
  retry,
  label = "Loading data",
}: {
  pending: boolean
  error: Error | null
  retry: () => unknown
  label?: string
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
      <div role="status" aria-label={label} className="grid gap-4">
        <div className="h-24 animate-pulse rounded-xl bg-white" />
        <div className="h-72 animate-pulse rounded-xl bg-white" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  return null
}
