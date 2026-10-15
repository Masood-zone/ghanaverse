import { requireUserPage } from "@/lib/auth/access"
import { LibraryContent } from "@/components/library/library-content"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  await requireUserPage("/library")
  const params = await searchParams
  return (
    <LibraryContent
      tab={params.tab === "history" ? "history" : "list"}
      page={Math.max(1, Math.floor(Number(params.page) || 1))}
    />
  )
}
