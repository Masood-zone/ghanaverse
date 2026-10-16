import { requireUser } from "@/lib/auth/access"
import { requireActiveProfile } from "@/lib/profiles"
import { apiSuccess } from "@/lib/api-response"
import { routeError, PlatformError } from "@/lib/route-error"
import { startPlaybackSession } from "@/services/viewer/playback-operations"
export async function POST(request: Request) {
  try {
    const { user } = await requireUser()
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      throw new PlatformError(
        403,
        "INVALID_ORIGIN",
        "Request origin is not permitted."
      )
    const profile = await requireActiveProfile(user.id)
    return apiSuccess(
      await startPlaybackSession(user.id, profile.id, await request.json())
    )
  } catch (error) {
    return routeError(error, "The stream could not be recorded.")
  }
}
