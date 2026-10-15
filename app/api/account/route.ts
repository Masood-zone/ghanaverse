import { apiSuccess } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/access"
import { routeError } from "@/lib/route-error"
import { getProfilesData } from "@/services/viewer/operations"
export async function GET() {
  try {
    const { user } = await requireUser()
    return apiSuccess({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(await getProfilesData(user.id)),
    })
  } catch (error) {
    return routeError(error)
  }
}
