import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api-response";
import { requireUser } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { ACTIVE_PROFILE_COOKIE, MAX_PROFILES } from "@/lib/profiles";
import { profileSchema } from "@/lib/platform-validation";
import { PlatformError, routeError } from "@/lib/route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(); const input = profileSchema.parse(await request.json());
    if (await getPrisma().viewerProfile.count({ where: { userId: user.id } }) >= MAX_PROFILES) throw new PlatformError(409, "PROFILE_LIMIT_REACHED", `An account can have up to ${MAX_PROFILES} profiles.`);
    const profile = await getPrisma().viewerProfile.create({ data: { userId: user.id, ...input } });
    (await cookies()).set(ACTIVE_PROFILE_COOKIE, profile.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return apiSuccess(profile, "Profile created.");
  } catch (error) { return routeError(error, "Profile could not be created."); }
}
