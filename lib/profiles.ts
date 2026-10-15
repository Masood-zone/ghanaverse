import "server-only";

import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { PlatformError } from "@/lib/route-error";

export const ACTIVE_PROFILE_COOKIE = "ghanaverse.active_profile";
export const MAX_PROFILES = 5;

export async function getActiveProfile(userId: string) {
  const selectedId = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value;
  if (selectedId) {
    const selected = await getPrisma().viewerProfile.findFirst({ where: { id: selectedId, userId } });
    if (selected) return selected;
  }
  return getPrisma().viewerProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function requireOwnedProfile(userId: string, profileId: string) {
  const profile = await getPrisma().viewerProfile.findFirst({ where: { id: profileId, userId } });
  if (!profile) throw new PlatformError(404, "PROFILE_NOT_FOUND", "Viewer profile was not found.");
  return profile;
}

export async function requireActiveProfile(userId: string) {
  const profile = await getActiveProfile(userId);
  if (!profile) throw new PlatformError(409, "PROFILE_REQUIRED", "Create a viewer profile to continue.");
  return profile;
}
