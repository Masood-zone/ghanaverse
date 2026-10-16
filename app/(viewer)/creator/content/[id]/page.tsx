import { ContentEditorContent } from "@/components/admin/content-editor-content"
import { CreatorAccessRequired } from "@/components/auth/creator-access-required"
import { requireUserPage } from "@/lib/auth/access"
import { canManageContent } from "@/lib/auth/policy"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<PageSearchParams>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { user } = await requireUserPage(
    callbackWithSearch(`/creator/content/${id}`, query)
  )
  if (!canManageContent(user.role)) return <CreatorAccessRequired />
  return <ContentEditorContent id={id} scope="creator" />
}
