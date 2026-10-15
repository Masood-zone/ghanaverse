import "server-only"
import { requireAdmin } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { routeError, PlatformError } from "@/lib/route-error"
import { readAdmin, mutateAdmin } from "./operations"
export async function handleAdmin(request: Request) {
  try {
    const { user } = await requireAdmin()
    const url = new URL(request.url)
    if (request.method === "GET") return apiSuccess(await readAdmin(url))
    const origin = request.headers.get("origin")
    if (origin && origin !== url.origin)
      throw new PlatformError(
        403,
        "INVALID_ORIGIN",
        "Request origin is not permitted"
      )
    const body =
      request.method === "DELETE"
        ? null
        : await request.json().catch(() => {
            throw new PlatformError(
              400,
              "INVALID_JSON",
              "Request must contain valid JSON"
            )
          })
    return apiSuccess(
      await mutateAdmin(url, request.method, body, user.id),
      "Changes saved"
    )
  } catch (error) {
    return routeError(error)
  }
}
