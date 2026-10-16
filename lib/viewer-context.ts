import "server-only"
import { cache } from "react"
import { getOptionalUser } from "@/lib/auth/access"
import { getActiveProfile } from "@/lib/profiles"
export const getViewerContext = cache(async () => {
  const access = await getOptionalUser()
  return {
    access,
    profile: access ? await getActiveProfile(access.user.id) : null,
  }
})
