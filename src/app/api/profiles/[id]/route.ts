import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { ACTIVE_PROFILE_COOKIE, requireOwnedProfile } from "@/lib/profiles";
import { profileSchema } from "@/lib/platform-validation";
import { PlatformError, routeError } from "@/lib/route-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(); const { id } = await params; await requireOwnedProfile(user.id, id);
    const profile = await getPrisma().viewerProfile.update({ where: { id }, data: profileSchema.parse(await request.json()) });
    return apiSuccess(profile, "Profile updated.");
  } catch (error) { return routeError(error, "Profile could not be updated."); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(); const { id } = await params; await requireOwnedProfile(user.id, id);
    if (await getPrisma().viewerProfile.count({ where: { userId: user.id } }) <= 1) throw new PlatformError(409, "FINAL_PROFILE_REQUIRED", "An account must keep at least one viewer profile.");
    await getPrisma().viewerProfile.delete({ where: { id } });
    const cookieStore = await cookies(); if (cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value === id) cookieStore.delete(ACTIVE_PROFILE_COOKIE);
    return apiSuccess({ id }, "Profile deleted.");
  } catch (error) { return routeError(error, "Profile could not be deleted."); }
}
