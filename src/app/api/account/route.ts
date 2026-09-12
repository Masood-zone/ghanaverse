import { apiError, apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/access";

export async function GET() {
  try { const { user } = await requireUser(); return apiSuccess({ id: user.id, name: user.name, email: user.email, role: user.role }); }
  catch { return apiError("Authentication is required.", 401, "AUTH_REQUIRED"); }
}
