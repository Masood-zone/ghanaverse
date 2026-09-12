import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AccessError, requireAdmin } from "@/lib/auth/access";
import { safeRemoteImageUrl } from "@/lib/image-policy";
import { getPrisma } from "@/lib/prisma";
import { extractYouTubeVideoId } from "@/lib/youtube";

const schema = z.object({ title: z.string().trim().min(1).max(180), description: z.string().trim().min(1).max(6000), shortDescription: z.string().trim().min(1).max(240), posterUrl: z.string().trim().optional().or(z.literal("")), backdropUrl: z.string().trim().optional().or(z.literal("")), publicationStatus: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]), trailerUrl: z.string().trim().optional().or(z.literal("")) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const input = schema.parse(await request.json()); const { id } = await params;
    const posterUrl = input.posterUrl ? safeRemoteImageUrl(input.posterUrl) : null; const backdropUrl = input.backdropUrl ? safeRemoteImageUrl(input.backdropUrl) : null;
    if ((input.posterUrl && !posterUrl) || (input.backdropUrl && !backdropUrl)) return apiError("Artwork must use an approved HTTPS image host.", 400, "INVALID_ARTWORK_URL");
    const trailerId = input.trailerUrl ? extractYouTubeVideoId(input.trailerUrl) : undefined; if (input.trailerUrl && !trailerId) return apiError("Trailer must be a valid YouTube video URL or ID.", 400, "INVALID_TRAILER_URL");
    const content = await getPrisma().content.update({ where: { id }, data: { title: input.title, description: input.description, shortDescription: input.shortDescription, posterUrl, backdropUrl, publicationStatus: input.publicationStatus, publishedAt: input.publicationStatus === "PUBLISHED" ? new Date() : null } });
    if (trailerId) await getPrisma().trailer.upsert({ where: { contentId: id }, create: { contentId: id, youtubeVideoId: trailerId }, update: { youtubeVideoId: trailerId } });
    return apiSuccess(content, "Content updated.");
  } catch (error) { if (error instanceof AccessError) return apiError(error.code === "AUTH_REQUIRED" ? "Authentication required." : "Administrator access required.", error.code === "AUTH_REQUIRED" ? 401 : 403, error.code); if (error instanceof z.ZodError) return apiError("Please correct the highlighted content fields.", 400, "INVALID_CONTENT"); return apiError("Content could not be updated.", 500, "CONTENT_UPDATE_FAILED"); }
}
