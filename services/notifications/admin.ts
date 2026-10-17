import "server-only"
import { z } from "zod"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/platform-error"
import { NotificationStatus } from "@/app/generated/prisma/enums"
import type { Prisma } from "@/app/generated/prisma/client"
async function admin(tx: Prisma.TransactionClient, actorId: string) {
  const user = await tx.user.findUnique({ where: { id: actorId } })
  if (!user || user.isSuspended || user.role !== "ADMIN")
    throw new PlatformError(
      403,
      "ADMIN_REQUIRED",
      "Administrator access required."
    )
}
export async function notificationQueue(actorId: string, raw: unknown) {
  const query = z
    .object({
      status: z.enum(NotificationStatus).optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    })
    .parse(raw)
  const db = getPrisma()
  await admin(db, actorId)
  const where = query.status ? { status: query.status } : {}
  const [items, total] = await Promise.all([
    db.notificationOutbox.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
      skip: (query.page - 1) * 30,
      select: {
        id: true,
        eventKey: true,
        channel: true,
        status: true,
        attempts: true,
        providerMessageId: true,
        lastError: true,
        acceptedAt: true,
        deliveredAt: true,
        createdAt: true,
        recipient: { select: { name: true } },
      },
    }),
    db.notificationOutbox.count({ where }),
  ])
  return { items, total, page: query.page }
}
export async function resolveNotification(
  actorId: string,
  id: string,
  raw: unknown
) {
  const input = z
    .discriminatedUnion("action", [
      z
        .object({
          action: z.literal("accepted"),
          providerMessageId: z.string().trim().min(1).max(200),
          note: z.string().trim().min(10).max(500),
        })
        .strict(),
      z
        .object({
          action: z.literal("retry"),
          confirmedNotAccepted: z.literal(true),
          note: z.string().trim().min(10).max(500),
        })
        .strict(),
      z
        .object({
          action: z.literal("cancel"),
          note: z.string().trim().min(10).max(500),
        })
        .strict(),
    ])
    .parse(raw)
  return getPrisma().$transaction(async (tx) => {
    await admin(tx, actorId)
    const allowed =
      input.action === "retry"
        ? ["AMBIGUOUS", "FAILED"]
        : ["AMBIGUOUS", "FAILED", "PENDING"]
    const result = await tx.notificationOutbox.updateMany({
      where: {
        id,
        status: { in: allowed as ("AMBIGUOUS" | "FAILED" | "PENDING")[] },
      },
      data: {
        status:
          input.action === "accepted"
            ? "ACCEPTED"
            : input.action === "retry"
              ? "PENDING"
              : "CANCELLED",
        claimToken: null,
        lastError: null,
        reconciliationNote: input.note,
        ...(input.action === "accepted"
          ? {
              providerMessageId: input.providerMessageId,
              acceptedAt: new Date(),
              nextAttemptAt: new Date(),
            }
          : {}),
        ...(input.action === "retry"
          ? { attempts: 0, nextAttemptAt: new Date() }
          : {}),
      },
    })
    if (!result.count)
      throw new PlatformError(
        409,
        "RECONCILIATION_CONFLICT",
        "This notification is not awaiting reconciliation. Refresh the queue."
      )
    await tx.auditLog.create({
      data: {
        actorId,
        action: `NOTIFICATION_${input.action.toUpperCase()}`,
        entityType: "notification",
        entityId: id,
      },
    })
    return { id }
  })
}
