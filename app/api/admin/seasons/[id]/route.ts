import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { seasonSchema } from "@/lib/platform-validation";
import { routeError } from "@/lib/route-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); const { id } = await params; return apiSuccess(await getPrisma().season.update({ where: { id }, data: seasonSchema.parse(await request.json()) }), "Season updated."); }
  catch (error) { return routeError(error, "Season could not be updated."); }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); const { id } = await params; await getPrisma().season.delete({ where: { id } }); return apiSuccess({ id }, "Season deleted."); }
  catch (error) { return routeError(error, "Season could not be deleted."); }
}
