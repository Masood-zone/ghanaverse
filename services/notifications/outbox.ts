import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import type { NotificationEvent } from "./templates"
export type { NotificationEvent } from "./templates"

export async function enqueueUserNotification(
  tx: Prisma.TransactionClient,
  input: { eventKey: string; userId: string; event: NotificationEvent }
) {
  const user = await tx.user.findUnique({ where: { id: input.userId } })
  if (!user || user.isSuspended) return
  const common = {
    eventKey: input.eventKey,
    recipientId: user.id,
    event: input.event,
  }
  await tx.notificationOutbox.createMany({
    data: [
      { ...common, channel: "EMAIL", recipientAddress: user.email },
      ...(user.phone && user.phoneVerifiedAt && user.transactionalSmsConsent
        ? [{ ...common, channel: "SMS" as const, recipientAddress: user.phone }]
        : []),
    ],
    skipDuplicates: true,
  })
}

export async function enqueueRightsHolderNotification(
  tx: Prisma.TransactionClient,
  rightsHolderId: string,
  eventKey: string,
  event: NotificationEvent
) {
  const members = await tx.rightsHolderMembership.findMany({
    where: { rightsHolderId },
    select: { userId: true },
  })
  for (const member of members)
    await enqueueUserNotification(tx, {
      eventKey,
      userId: member.userId,
      event: { ...event, audienceRightsHolderId: rightsHolderId },
    })
}

export async function enqueueAdminAlert(
  tx: Prisma.TransactionClient,
  eventKey: string,
  message: string
) {
  const admins = await tx.user.findMany({
    where: { role: "ADMIN", isSuspended: false },
    select: { id: true },
  })
  for (const admin of admins)
    await enqueueUserNotification(tx, {
      eventKey,
      userId: admin.id,
      event: { type: "ADMIN_ALERT", message },
    })
}
