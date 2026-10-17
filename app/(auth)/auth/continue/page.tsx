import { redirect } from "next/navigation"
import { requireUserPage } from "@/lib/auth/access"
import { profilePickerUrl, safeCallbackUrl } from "@/lib/auth/callback"
import { isAdminRole } from "@/lib/auth/policy"
import { getPrisma } from "@/lib/prisma"

export default async function AuthContinuationPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const destination = safeCallbackUrl((await searchParams).callbackUrl)
  const { user } = await requireUserPage(destination)
  if (isAdminRole(user.role) && !/^\/plans(?:[/?]|$)/.test(destination))
    redirect("/admin")
  const profiles = await getPrisma().viewerProfile.findMany({
    where: { userId: user.id },
    select: { id: true },
    take: 2,
  })
  redirect(profiles.length > 1 ? profilePickerUrl(destination) : destination)
}
