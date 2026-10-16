import { apiError, apiSuccess } from "@/lib/api-response"
import { getPublishedContentBySlug } from "@/lib/catalogue"
import { publicContent } from "@/lib/public-content"
import { routeError } from "@/lib/route-error"
import { getViewerContext } from "@/lib/viewer-context"
import { canViewContent } from "@/lib/viewer-policy"
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const content = await getPublishedContentBySlug((await params).slug)
    const { profile } = await getViewerContext()
    if (content && !canViewContent(profile, content))
      return apiError(
        "This title is not available in Kids mode.",
        403,
        "PROFILE_CONTENT_RESTRICTED"
      )
    return content
      ? apiSuccess(publicContent(content))
      : apiError("Content was not found", 404, "NOT_FOUND")
  } catch (error) {
    return routeError(error)
  }
}
