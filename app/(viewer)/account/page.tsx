import { requireUserPage } from "@/lib/auth/access"
import { AccountContent } from "@/components/account/account-content"
export default async function Page() {
  await requireUserPage("/account")
  return <AccountContent />
}
