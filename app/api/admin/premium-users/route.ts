import { requireAdmin } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { routeError } from "@/lib/route-error"
import { readPremiumUsers } from "@/services/admin/premium-users-operations"

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const result = await readPremiumUsers(
      Object.fromEntries(new URL(request.url).searchParams)
    )
    const response = apiSuccess(result)
    response.headers.set("Cache-Control", "private, no-store")
    return response
  } catch (error) {
    return routeError(error, "Premium users could not be loaded.")
  }
}
