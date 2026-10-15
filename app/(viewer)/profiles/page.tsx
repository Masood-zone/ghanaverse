import { requireUserPage } from "@/lib/auth/access"
import { ProfilesContent } from "@/components/profiles/profiles-content"
export default async function Page() {
  await requireUserPage("/profiles")
  return <ProfilesContent />
}
