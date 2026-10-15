import Link from "next/link"
export default function NotFound() {
  return (
    <div className="gv-panel">
      <h1 className="text-2xl font-bold">Record not found</h1>
      <Link href="/admin" className="gv-action mt-4">
        Return to dashboard
      </Link>
    </div>
  )
}
