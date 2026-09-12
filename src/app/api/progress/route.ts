import { PublicationStatus } from "@/generated/prisma/enums";
import { apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/access";
import { isPermittedPlaybackAsset } from "@/lib/image-policy";
import { getPrisma } from "@/lib/prisma";
import { progressSchema } from "@/lib/platform-validation";
import { requireActiveProfile } from "@/lib/profiles";
import { PlatformError, routeError } from "@/lib/route-error";

export async function PUT(request: Request) {
  try {
    const { user } = await requireUser(); const profile = await requireActiveProfile(user.id);
    const input = progressSchema.parse(await request.json());
    const asset = await getPrisma().videoAsset.findUnique({ where: { id: input.videoAssetId }, include: { content: true, episode: { include: { season: { include: { series: true } } } } } });
    const parent = asset?.content ?? asset?.episode?.season.series;
    if (!asset || !parent || parent.publicationStatus !== PublicationStatus.PUBLISHED) throw new PlatformError(404, "VIDEO_NOT_FOUND", "Playable media was not found.");
    if (!isPermittedPlaybackAsset(asset)) throw new PlatformError(403, "PLAYBACK_NOT_PERMITTED", "This media asset is not permitted for playback.");
    if (parent.isPremium) throw new PlatformError(403, "PREMIUM_REQUIRED", "Premium playback is not available in this phase.");
    const durationSeconds = input.durationSeconds ?? asset.durationSeconds;
    const completed = input.completed || Boolean(durationSeconds && input.positionSeconds / durationSeconds >= 0.9);
    const key = asset.episodeId ? { episodeId: asset.episodeId } : { contentId: asset.contentId };
    const progress = await getPrisma().$transaction(async (tx) => {
      const existing = await tx.watchProgress.findFirst({ where: { profileId: profile.id, ...key }, orderBy: { lastWatchedAt: "desc" } });
      const data = { profileId: profile.id, contentId: asset.contentId, episodeId: asset.episodeId, positionSeconds: input.positionSeconds, durationSeconds, completed, lastWatchedAt: new Date() };
      return existing ? tx.watchProgress.update({ where: { id: existing.id }, data }) : tx.watchProgress.create({ data });
    });
    return apiSuccess(progress, "Viewing progress saved.");
  } catch (error) { return routeError(error, "Viewing progress could not be saved."); }
}
