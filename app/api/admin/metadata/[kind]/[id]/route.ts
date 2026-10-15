import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { deleteMetadata, updateMetadata } from "@/lib/metadata-admin";
import { routeError } from "@/lib/route-error";

type Context = { params: Promise<{ kind: string; id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try { await requireAdmin(); const { kind, id } = await params; return apiSuccess(await updateMetadata(kind, id, await request.json()), "Record updated."); }
  catch (error) { return routeError(error, "Record could not be updated."); }
}
export async function DELETE(_: Request, { params }: Context) {
  try { await requireAdmin(); const { kind, id } = await params; return apiSuccess(await deleteMetadata(kind, id), "Record deleted."); }
  catch (error) { return routeError(error, "Record could not be deleted."); }
}
