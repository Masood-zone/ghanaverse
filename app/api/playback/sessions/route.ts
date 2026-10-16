import { requireUser } from "@/lib/auth/access"
import { requireActiveProfile } from "@/lib/profiles"
import { apiSuccess } from "@/lib/api-response"
import { routeError, PlatformError } from "@/lib/route-error"
import { startPlaybackSession } from "@/services/viewer/playback-operations"
import { playbackSessionSchema } from "@/lib/validation/playback"
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
    const input = playbackSessionSchema.parse(await request.json())
    const profile = await requireActiveProfile(user.id, input.profileId)
    return apiSuccess(await startPlaybackSession(user.id, profile.id, input))
  } catch (error) {
    return routeError(error, "The stream could not be recorded.")
  }
}
