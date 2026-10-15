import { apiSuccess } from "@/lib/api-response";
import { updateContent } from "@/lib/admin-content";
import { requireAdmin } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { PlatformError, routeError } from "@/lib/route-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); return apiSuccess(await updateContent((await params).id, await request.json()), "Content updated."); }
  catch (error) { return routeError(error, "Content could not be updated."); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(); const { id } = await params;
    const existing = await getPrisma().content.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new PlatformError(404, "CONTENT_NOT_FOUND", "Content was not found.");
    await getPrisma().content.delete({ where: { id } });
    return apiSuccess({ id }, "Content deleted.");
  } catch (error) { return routeError(error, "Content could not be deleted."); }
}
