import { requireUserPage } from "@/lib/auth/access"
import { ProfilesContent } from "@/components/profiles/profiles-content"
import {
  safeCallbackUrl,
  callbackWithSearch,
  type PageSearchParams,
} from "@/lib/auth/callback"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const query = await searchParams
  const destination = safeCallbackUrl(query.callbackUrl)
  await requireUserPage(callbackWithSearch("/profiles", query))
  return <ProfilesContent callbackUrl={destination} />
}
