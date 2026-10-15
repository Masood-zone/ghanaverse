import { requireUser } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { routeError } from "@/lib/route-error"
import { getViewerLibrary } from "@/services/viewer/operations"
export async function GET() {
  try {
    const { user } = await requireUser()
    return apiSuccess(await getViewerLibrary(user.id))
  } catch (error) {
    return routeError(error)
  }
}
