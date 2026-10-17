import { requireAdmin } from "@/lib/auth/access"
import { verifyOrigin } from "@/lib/viewer-photos"
import { apiSuccess } from "@/lib/api-response"
import { routeError } from "@/lib/route-error"
import { resolveNotification } from "@/services/notifications/admin"
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdmin()
    verifyOrigin(request)
    return apiSuccess(
      await resolveNotification(
        user.id,
        (await params).id,
        await request.json()
      )
    )
  } catch (error) {
    return routeError(error)
  }
}
