import { requireUserPage } from "@/lib/auth/access"
import { ProfilesContent } from "@/components/profiles/profiles-content"
import { safeCallbackUrl } from "@/lib/auth/callback"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  const destination = safeCallbackUrl(callbackUrl)
  await requireUserPage(
    `/profiles?callbackUrl=${encodeURIComponent(destination)}`
  )
  return <ProfilesContent callbackUrl={destination} />
}
