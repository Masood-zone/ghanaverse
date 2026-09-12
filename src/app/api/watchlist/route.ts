import { PublicationStatus } from "@/generated/prisma/enums";
import { apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { watchlistSchema } from "@/lib/platform-validation";
import { requireActiveProfile } from "@/lib/profiles";
import { PlatformError, routeError } from "@/lib/route-error";

async function context(request: Request) {
  const { user } = await requireUser(); const profile = await requireActiveProfile(user.id);
  const { contentId } = watchlistSchema.parse(await request.json());
  const content = await getPrisma().content.findFirst({ where: { id: contentId, publicationStatus: PublicationStatus.PUBLISHED } });
  if (!content) throw new PlatformError(404, "CONTENT_NOT_FOUND", "Published content was not found.");
  return { profile, content };
}

export async function PUT(request: Request) {
  try {
    const { profile, content } = await context(request);
    const item = await getPrisma().watchlistItem.upsert({ where: { profileId_contentId: { profileId: profile.id, contentId: content.id } }, update: {}, create: { profileId: profile.id, contentId: content.id } });
    return apiSuccess(item, "Added to My List.");
  } catch (error) { return routeError(error, "My List could not be updated."); }
}

export async function DELETE(request: Request) {
  try {
    const { profile, content } = await context(request);
    await getPrisma().watchlistItem.deleteMany({ where: { profileId: profile.id, contentId: content.id } });
    return apiSuccess({ contentId: content.id }, "Removed from My List.");
  } catch (error) { return routeError(error, "My List could not be updated."); }
}
