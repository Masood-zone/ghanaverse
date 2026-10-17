import "server-only"
import { z } from "zod"
import { Prisma } from "@/app/generated/prisma/client"
import { getPrisma, sqlTable } from "@/lib/prisma"
import { paymentConfiguration } from "@/lib/paystack"

const querySchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z
    .enum(["all", "active", "expiring", "expired", "suspended"])
    .default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
})
type MemberRow = {
  id: string
  name: string
  email: string
  isSuspended: boolean
  expiresAt: Date
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "SUSPENDED"
}

export async function readPremiumUsers(raw: unknown, now = new Date()) {
  const query = querySchema.parse(raw)
  const { mode } = paymentConfiguration()
  const take = 20
  if (!mode)
    return {
      mode,
      active: 0,
      expiring: 0,
      expired: 0,
      total: 0,
      page: 1,
      totalPages: 1,
      items: [] as (Omit<MemberRow, "expiresAt"> & { expiresAt: string })[],
    }
  const soon = new Date(now.getTime() + 7 * 86400000)
  // Merge touching/overlapping grants before applying the expiry filter, so an
  // early renewal is one continuous pass rather than an expiring old purchase.
  const cte = Prisma.sql`WITH grants AS (
    SELECT id, "userId", "startsAt", "endsAt",
      MAX("endsAt") OVER (PARTITION BY "userId" ORDER BY "startsAt", "endsAt", id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS "previousEnd"
    FROM ${sqlTable("PremiumGrant")} WHERE mode = ${mode} AND "revokedAt" IS NULL
  ), islands AS (
    SELECT *, SUM(CASE WHEN "previousEnd" IS NULL OR "startsAt" > "previousEnd" THEN 1 ELSE 0 END)
      OVER (PARTITION BY "userId" ORDER BY "startsAt", "endsAt", id) AS island FROM grants
  ), windows AS (
    SELECT "userId", MIN("startsAt") AS "startsAt", MAX("endsAt") AS "endsAt" FROM islands GROUP BY "userId", island
  ), history AS (
    SELECT "userId",
      MAX("endsAt") FILTER (WHERE "startsAt" <= ${now} AND "endsAt" > ${now}) AS "activeUntil",
      MAX("endsAt") FILTER (WHERE "endsAt" <= ${now}) AS "lastExpiry"
    FROM windows GROUP BY "userId"
  ), members AS (
    SELECT u.id, u.name, u.email, u."isSuspended",
      COALESCE(h."activeUntil", h."lastExpiry") AS "expiresAt",
      CASE WHEN h."activeUntil" IS NULL THEN 'EXPIRED'
        WHEN u."isSuspended" THEN 'SUSPENDED'
        WHEN h."activeUntil" <= ${soon} THEN 'EXPIRING' ELSE 'ACTIVE' END AS status
    FROM history h JOIN ${sqlTable("User")} u ON u.id = h."userId"
    WHERE h."activeUntil" IS NOT NULL OR h."lastExpiry" IS NOT NULL
  )`
  const search = query.q
    ? Prisma.sql`(POSITION(${query.q.toLowerCase()} IN LOWER(name)) > 0 OR POSITION(${query.q.toLowerCase()} IN LOWER(email)) > 0)`
    : Prisma.sql`TRUE`
  const status =
    query.status === "active"
      ? Prisma.sql`status IN ('ACTIVE', 'EXPIRING')`
      : query.status === "all"
        ? Prisma.sql`TRUE`
        : Prisma.sql`status = ${query.status.toUpperCase()}`
  const filter = Prisma.sql`${search} AND ${status}`
  const db = getPrisma()
  const [counts] = await db.$queryRaw<
    { active: bigint; expiring: bigint; expired: bigint; total: bigint }[]
  >(Prisma.sql`${cte}
    SELECT COUNT(*) FILTER (WHERE status IN ('ACTIVE', 'EXPIRING')) AS active,
      COUNT(*) FILTER (WHERE status = 'EXPIRING') AS expiring,
      COUNT(*) FILTER (WHERE status = 'EXPIRED') AS expired,
      COUNT(*) FILTER (WHERE ${filter}) AS total FROM members`)
  const total = Number(counts.total)
  const totalPages = Math.max(1, Math.ceil(total / take))
  const page = Math.min(query.page, totalPages)
  const items = await db.$queryRaw<MemberRow[]>(Prisma.sql`${cte}
    SELECT * FROM members WHERE ${filter} ORDER BY "expiresAt" DESC, id LIMIT ${take} OFFSET ${(page - 1) * take}`)
  return {
    mode,
    active: Number(counts.active),
    expiring: Number(counts.expiring),
    expired: Number(counts.expired),
    total,
    page,
    totalPages,
    items: items.map((item) => ({
      ...item,
      expiresAt: item.expiresAt.toISOString(),
    })),
  }
}
