import { VideoSourceType } from "@/generated/prisma/enums";
import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { safePlaybackUrl } from "@/lib/image-policy";
import { getPrisma } from "@/lib/prisma";
import { videoAssetSchema } from "@/lib/platform-validation";
import { PlatformError, routeError } from "@/lib/route-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const { id } = await params; const input = videoAssetSchema.parse(await request.json());
    const playbackUrl = safePlaybackUrl(input.playbackUrl, input.sourceType === VideoSourceType.DEMO);
    if (!playbackUrl) throw new PlatformError(400, "INVALID_PLAYBACK_URL", "Use an HTTPS remote URL or a local /media demo asset.");
    if (input.isPlayable && input.sourceType === VideoSourceType.MANAGED) throw new PlatformError(400, "PLAYBACK_NOT_PERMITTED", "Managed assets cannot be made playable in Phase 4.");
    return apiSuccess(await getPrisma().videoAsset.update({ where: { id }, data: { ...input, playbackUrl, contentId: input.episodeId ? null : undefined } }), "Video asset updated.");
  } catch (error) { return routeError(error, "Video asset could not be updated."); }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); const { id } = await params; await getPrisma().videoAsset.delete({ where: { id } }); return apiSuccess({ id }, "Video asset deleted."); }
  catch (error) { return routeError(error, "Video asset could not be deleted."); }
}
