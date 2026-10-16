import { CreatorLibrary } from "@/components/admin/creator-library"
import { CreatorAccessRequired } from "@/components/auth/creator-access-required"
import { requireUserPage } from "@/lib/auth/access"
import { canManageContent } from "@/lib/auth/policy"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const { user } = await requireUserPage(
    callbackWithSearch("/creator/content", await searchParams)
  )
  if (!canManageContent(user.role)) return <CreatorAccessRequired />
  return <CreatorLibrary />
}
