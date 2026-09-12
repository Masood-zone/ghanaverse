import { apiSuccess } from "@/lib/api-response";
import { createContent } from "@/lib/admin-content";
import { requireAdmin } from "@/lib/auth/access";
import { routeError } from "@/lib/route-error";

export async function POST(request: Request) {
  try { await requireAdmin(); return apiSuccess(await createContent(await request.json()), "Content created."); }
  catch (error) { return routeError(error, "Content could not be created."); }
}
