"use client"
export default function ErrorPage({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div role="alert" className="rounded-xl bg-white p-8">
      <h1 className="text-xl font-bold">The workspace could not load</h1>
      <p className="mt-2">Check your connection and try again.</p>
      <button onClick={reset} className="gv-action mt-4">
        Try again
      </button>
    </div>
  )
}
