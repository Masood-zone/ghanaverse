import Link from "@/components/common/app-link"
import { profilePickerUrl } from "@/lib/auth/callback"
export function RestrictedContent({ callbackUrl }: { callbackUrl: string }) {
  return (
    <section className="gv-container py-20 text-center">
      <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800">
        Kids mode
      </span>
      <h1 className="mt-6 text-3xl font-extrabold">
        This title is not available for this profile
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
        Kids profiles show U and PG titles. Switch to a regular profile to open
        this title.
      </p>
      <Link href={profilePickerUrl(callbackUrl)} className="gv-action mt-6">
        Switch profile
      </Link>
      <Link href="/browse" className="gv-action secondary mt-6 ml-3">
        Browse Kids titles
      </Link>
    </section>
  )
}
