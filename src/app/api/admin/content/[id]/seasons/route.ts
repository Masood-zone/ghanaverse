import { ContentType } from "@/generated/prisma/enums";
import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { seasonSchema } from "@/lib/platform-validation";
import { PlatformError, routeError } from "@/lib/route-error";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const { id } = await params; const input = seasonSchema.parse(await request.json());
    const series = await getPrisma().content.findUnique({ where: { id }, select: { contentType: true } });
    if (series?.contentType !== ContentType.SERIES) throw new PlatformError(400, "SERIES_REQUIRED", "Seasons can only be added to series.");
    return apiSuccess(await getPrisma().season.create({ data: { seriesId: id, ...input } }), "Season added.");
  } catch (error) { return routeError(error, "Season could not be added."); }
}
