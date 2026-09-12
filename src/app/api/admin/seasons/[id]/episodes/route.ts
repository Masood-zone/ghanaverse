import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { safeArtworkUrl } from "@/lib/image-policy";
import { getPrisma } from "@/lib/prisma";
import { episodeSchema } from "@/lib/platform-validation";
import { PlatformError, routeError } from "@/lib/route-error";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const { id } = await params; const input = episodeSchema.parse(await request.json());
    const thumbnailUrl = input.thumbnailUrl ? safeArtworkUrl(input.thumbnailUrl) : null;
    if (input.thumbnailUrl && !thumbnailUrl) throw new PlatformError(400, "INVALID_ARTWORK_URL", "Episode artwork must use a trusted source.");
    return apiSuccess(await getPrisma().episode.create({ data: { seasonId: id, ...input, thumbnailUrl, airDate: input.airDate ? new Date(input.airDate) : null } }), "Episode added.");
  } catch (error) { return routeError(error, "Episode could not be added."); }
}
