import { requireAdminPage } from "@/lib/auth/access"
import { NotificationsContent } from "@/components/admin/notifications-content"
export default async function Page() {
  await requireAdminPage("/admin/notifications")
  return <NotificationsContent />
}
