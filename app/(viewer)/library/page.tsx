import { requireUserPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
import { LibraryContent } from "@/components/library/library-content"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const params = await searchParams
  await requireUserPage(callbackWithSearch("/library", params))
  return (
    <LibraryContent
      tab={params.tab === "history" ? "history" : "list"}
      page={Math.max(1, Math.floor(Number(params.page) || 1))}
    />
  )
}
