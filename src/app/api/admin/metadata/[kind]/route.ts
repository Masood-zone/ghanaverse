import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { createMetadata } from "@/lib/metadata-admin";
import { routeError } from "@/lib/route-error";

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try { await requireAdmin(); return apiSuccess(await createMetadata((await params).kind, await request.json()), "Record created."); }
  catch (error) { return routeError(error, "Record could not be created."); }
}
