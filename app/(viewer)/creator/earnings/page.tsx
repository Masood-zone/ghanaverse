import { requireUserPage } from "@/lib/auth/access"
import { LicensingContent } from "@/components/billing/licensing-content"
export default async function Page() {
  await requireUserPage("/creator/earnings")
  return <LicensingContent />
}
