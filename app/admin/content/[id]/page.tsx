import { ContentEditorContent } from "@/components/admin/content-editor-content"
import { requireAdminPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<PageSearchParams>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  await requireAdminPage(callbackWithSearch(`/admin/content/${id}`, query))
  return <ContentEditorContent id={id} />
}
