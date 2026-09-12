import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { safeRemoteImageUrl } from "@/lib/image-policy";
import { getPrisma } from "@/lib/prisma";
import { trailerSchema } from "@/lib/platform-validation";
import { PlatformError, routeError } from "@/lib/route-error";
import { extractYouTubeVideoId } from "@/lib/youtube";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const { id } = await params; const input = trailerSchema.parse(await request.json());
    const videoId = extractYouTubeVideoId(input.video); if (!videoId) throw new PlatformError(400, "INVALID_TRAILER_URL", "Enter a valid YouTube video URL or ID.");
    const thumbnailUrl = input.thumbnailUrl ? safeRemoteImageUrl(input.thumbnailUrl) : undefined;
    const trailer = await getPrisma().trailer.upsert({ where: { contentId: id }, create: { contentId: id, youtubeVideoId: videoId, title: input.title, thumbnailUrl }, update: { youtubeVideoId: videoId, title: input.title, thumbnailUrl } });
    return apiSuccess(trailer, "Trailer selected.");
  } catch (error) { return routeError(error, "Trailer could not be saved."); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); const { id } = await params; await getPrisma().trailer.deleteMany({ where: { contentId: id } }); return apiSuccess({ contentId: id }, "Trailer removed."); }
  catch (error) { return routeError(error, "Trailer could not be removed."); }
}
