import { ContentLibraryContent } from "@/components/admin/content-library-content"
import { requireAdminPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  await requireAdminPage(
    callbackWithSearch("/admin/content", await searchParams)
  )
  return <ContentLibraryContent />
}
