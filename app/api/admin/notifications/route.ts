import { requireAdmin } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { routeError } from "@/lib/route-error"
import { notificationQueue } from "@/services/notifications/admin"
export async function GET(request: Request) {
  try {
    const { user } = await requireAdmin()
    return apiSuccess(
      await notificationQueue(
        user.id,
        Object.fromEntries(new URL(request.url).searchParams)
      )
    )
  } catch (error) {
    return routeError(error)
  }
}
