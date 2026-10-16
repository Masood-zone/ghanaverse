import { UserRole } from "@/app/generated/prisma/enums"

export const DEFAULT_REGISTRATION_ROLE = UserRole.VIEWER
export function isAdminRole(role: UserRole) {
  return role === UserRole.ADMIN
}
export function canManageContent(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.RIGHTS_HOLDER
}
