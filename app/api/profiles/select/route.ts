import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/access";
import { ACTIVE_PROFILE_COOKIE, requireOwnedProfile } from "@/lib/profiles";
import { profileSelectionSchema } from "@/lib/platform-validation";
import { routeError } from "@/lib/route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(); const { profileId } = profileSelectionSchema.parse(await request.json());
    const profile = await requireOwnedProfile(user.id, profileId);
    (await cookies()).set(ACTIVE_PROFILE_COOKIE, profile.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return apiSuccess(profile, "Profile selected.");
  } catch (error) { return routeError(error, "Profile could not be selected."); }
}
