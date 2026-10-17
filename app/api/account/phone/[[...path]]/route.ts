import { requireUser } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { routeError } from "@/lib/route-error"
import { verifyOrigin } from "@/lib/viewer-photos"
import {
  requestPhoneCode,
  savePhoneSettings,
  verifyPhoneCode,
} from "@/services/notifications/phone"

async function handle(request: Request) {
  try {
    const { user } = await requireUser()
    verifyOrigin(request)
    const path = new URL(request.url).pathname
    if (request.method === "PATCH" && path === "/api/account/phone")
      return apiSuccess(await savePhoneSettings(user.id, await request.json()))
    if (request.method === "POST" && path === "/api/account/phone/request")
      return apiSuccess(await requestPhoneCode(user.id))
    if (request.method === "POST" && path === "/api/account/phone/verify")
      return apiSuccess(await verifyPhoneCode(user.id, await request.json()))
    return Response.json(
      { success: false, message: "Not found" },
      { status: 404 }
    )
  } catch (error) {
    return routeError(error)
  }
}
export { handle as PATCH, handle as POST }
