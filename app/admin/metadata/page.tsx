import { RegistryContent } from "@/components/admin/registry-content"
import { requireAdminPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  await requireAdminPage(
    callbackWithSearch("/admin/metadata", await searchParams)
  )
  return <RegistryContent />
}
