"use client"
export default function ErrorPage({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <main className="mx-auto max-w-xl p-8 py-24">
      <h1 className="text-2xl font-bold">
        GhanaVerse could not load this page
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Check your connection and try again.
      </p>
      <button className="gv-action mt-6" onClick={reset}>
        Try again
      </button>
    </main>
  )
}
