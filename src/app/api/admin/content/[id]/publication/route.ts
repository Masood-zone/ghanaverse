import { PublicationStatus } from "@/generated/prisma/enums";
import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { publicationSchema } from "@/lib/platform-validation";
import { routeError } from "@/lib/route-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const { status } = publicationSchema.parse(await request.json()); const { id } = await params;
    const content = await getPrisma().content.update({ where: { id }, data: { publicationStatus: status, publishedAt: status === PublicationStatus.PUBLISHED ? new Date() : null } });
    return apiSuccess(content, status === PublicationStatus.PUBLISHED ? "Content published." : "Content unpublished.");
  } catch (error) { return routeError(error, "Publication status could not be changed."); }
}
