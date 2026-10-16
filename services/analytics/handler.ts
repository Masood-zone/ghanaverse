import { requireAdmin, requireUser } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { routeError } from "@/lib/route-error"
import { getAnalytics, analyticsCsv } from "./operations"
export async function handleAnalytics(request: Request, admin: boolean) {
  try {
    const { user } = await (admin ? requireAdmin() : requireUser())
    const query = Object.fromEntries(new URL(request.url).searchParams)
    const report = await getAnalytics(user.id, query)
    if (query.format === "csv")
      return new Response("\uFEFF" + analyticsCsv(report), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition":
            'attachment; filename="ghanaverse-viewing-report.csv"',
          "cache-control": "private, no-store",
        },
      })
    const response = apiSuccess(report)
    response.headers.set("cache-control", "private, no-store")
    return response
  } catch (error) {
    return routeError(error, "Viewing reports could not be loaded.")
  }
}
