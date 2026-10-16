import { requireUserPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
import { AccountContent } from "@/components/account/account-content"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  await requireUserPage(callbackWithSearch("/account", await searchParams))
  return <AccountContent />
}
