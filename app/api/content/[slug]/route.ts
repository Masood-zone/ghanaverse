import { apiError, apiSuccess } from "@/lib/api-response"
import { getPublishedContentBySlug } from "@/lib/catalogue"
import { publicContent } from "@/lib/public-content"
import { routeError } from "@/lib/route-error"
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const content = await getPublishedContentBySlug((await params).slug)
    return content
      ? apiSuccess(publicContent(content))
      : apiError("Content was not found", 404, "NOT_FOUND")
  } catch (error) {
    return routeError(error)
  }
}
