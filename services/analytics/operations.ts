import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { getPrisma, sqlTable } from "@/lib/prisma"
import { PlatformError } from "@/lib/route-error"
import { z } from "zod"

export const analyticsQuerySchema = z.object({
  range: z.enum(["7", "30", "90", "all"]).default("30"),
  contentId: z.string().min(1).optional(),
  format: z.enum(["json", "csv"]).default("json"),
})
export async function analyticsScope(userId: string) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    include: { rightsHolderMemberships: true },
  })
  if (!user || user.isSuspended)
    throw new PlatformError(
      403,
      "REPORTS_FORBIDDEN",
      "Reporting access is unavailable."
    )
  if (user.role === "ADMIN") return { admin: true, holderIds: [] as string[] }
  if (user.role !== "RIGHTS_HOLDER" || !user.rightsHolderMemberships.length)
    throw new PlatformError(
      403,
      "REPORTS_FORBIDDEN",
      "Rights-holder reporting access is required."
    )
  return {
    admin: false,
    holderIds: user.rightsHolderMemberships.map(
      (membership) => membership.rightsHolderId
    ),
  }
}
type Row = {
  id: string
  title: string
  contentType: string
  episodeId: string | null
  streams: bigint
  viewers: bigint
  watchMs: bigint
  activeSessions: bigint
  completions: bigint
}
function displayRow(row: Row) {
  const activeSessions = Number(row.activeSessions)
  return {
    id: row.id,
    title: row.title,
    contentType: row.contentType,
    streams: Number(row.streams),
    viewers: Number(row.viewers),
    watchSeconds: Number(row.watchMs) / 1000,
    averageSeconds: activeSessions
      ? Number(row.watchMs) / 1000 / activeSessions
      : 0,
    completions: Number(row.completions),
    completionRate: activeSessions
      ? (Number(row.completions) / activeSessions) * 100
      : 0,
  }
}
export async function getAnalytics(
  userId: string,
  raw: unknown,
  now = new Date()
) {
  const query = analyticsQuerySchema.parse(raw),
    scope = await analyticsScope(userId),
    db = getPrisma()
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  )
  const since =
    query.range === "all"
      ? new Date(0)
      : new Date(end.getTime() - Number(query.range) * 86400000)
  const access = scope.admin
    ? Prisma.sql`TRUE`
    : Prisma.sql`c."rightsHolderId" IN (${Prisma.join(scope.holderIds)})`
  const titles = await db.content.findMany({
    where: scope.admin ? {} : { rightsHolderId: { in: scope.holderIds } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  })
  if (query.contentId && !titles.some((title) => title.id === query.contentId))
    throw new PlatformError(
      404,
      "TITLE_NOT_FOUND",
      "This title is not available in your reports."
    )
  const filter = Prisma.sql`${access} ${query.contentId ? Prisma.sql`AND c.id = ${query.contentId}` : Prisma.empty}`
  const selectMetrics = Prisma.sql`
    COUNT(DISTINCT s.id) FILTER (WHERE s."startedAt" >= ${since} AND s."startedAt" < ${end}) AS streams,
    COUNT(DISTINCT s."userId") FILTER (WHERE (s."startedAt" >= ${since} AND s."startedAt" < ${end}) OR (p."createdAt" >= ${since} AND p."createdAt" < ${end})) AS viewers,
    COALESCE(SUM(p."watchedMilliseconds") FILTER (WHERE p."createdAt" >= ${since} AND p."createdAt" < ${end}), 0)::bigint AS "watchMs",
    COUNT(DISTINCT s.id) FILTER (WHERE (s."startedAt" >= ${since} AND s."startedAt" < ${end}) OR (p."createdAt" >= ${since} AND p."createdAt" < ${end})) AS "activeSessions",
    COUNT(DISTINCT s.id) FILTER (WHERE s."completedAt" >= ${since} AND s."completedAt" < ${end}) AS completions`
  const [rows, totals, episodes, daily] = await Promise.all([
    db.$queryRaw<Row[]>(
      Prisma.sql`SELECT c.id, c.title, c."contentType"::text, ${selectMetrics} FROM ${sqlTable("Content")} c LEFT JOIN ${sqlTable("PlaybackSession")} s ON s."contentId" = c.id LEFT JOIN ${sqlTable("PlaybackSample")} p ON p."sessionId" = s.id WHERE ${filter} GROUP BY c.id ORDER BY "watchMs" DESC, streams DESC, c.title`
    ),
    db.$queryRaw<Row[]>(
      Prisma.sql`SELECT ${selectMetrics} FROM ${sqlTable("Content")} c LEFT JOIN ${sqlTable("PlaybackSession")} s ON s."contentId" = c.id LEFT JOIN ${sqlTable("PlaybackSample")} p ON p."sessionId" = s.id WHERE ${filter}`
    ),
    db.$queryRaw<Row[]>(
      Prisma.sql`SELECT e.id, c.title || ' — ' || e.title AS title, 'EPISODE' AS "contentType", ${selectMetrics} FROM ${sqlTable("Content")} c JOIN ${sqlTable("Season")} season ON season."seriesId" = c.id JOIN ${sqlTable("Episode")} e ON e."seasonId" = season.id LEFT JOIN ${sqlTable("PlaybackSession")} s ON s."episodeId" = e.id LEFT JOIN ${sqlTable("PlaybackSample")} p ON p."sessionId" = s.id WHERE ${filter} GROUP BY e.id, c.id ORDER BY "watchMs" DESC, e.title`
    ),
    db.$queryRaw<
      { day: string; streams: bigint; watchMs: bigint }[]
    >(Prisma.sql`SELECT day, SUM(streams)::bigint AS streams, SUM(ms)::bigint AS "watchMs" FROM (
      SELECT TO_CHAR(s."startedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*) AS streams, 0::bigint AS ms FROM ${sqlTable("PlaybackSession")} s JOIN ${sqlTable("Content")} c ON c.id = s."contentId" WHERE ${filter} AND s."startedAt" >= ${since} AND s."startedAt" < ${end} GROUP BY day
      UNION ALL SELECT TO_CHAR(p."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, 0::bigint, SUM(p."watchedMilliseconds") FROM ${sqlTable("PlaybackSample")} p JOIN ${sqlTable("PlaybackSession")} s ON s.id = p."sessionId" JOIN ${sqlTable("Content")} c ON c.id = s."contentId" WHERE ${filter} AND p."createdAt" >= ${since} AND p."createdAt" < ${end} GROUP BY day
    ) events GROUP BY day ORDER BY day`),
  ])
  return {
    range: query.range,
    timezone: "UTC",
    titles,
    summary: displayRow(totals[0]),
    rows: rows.map(displayRow),
    episodes: episodes.map(displayRow),
    daily: daily.map((day) => ({
      day: day.day,
      streams: Number(day.streams),
      watchSeconds: Number(day.watchMs) / 1000,
    })),
  }
}
export function analyticsCsv(report: Awaited<ReturnType<typeof getAnalytics>>) {
  const cell = (value: string | number) => {
    const text = String(value)
    return (
      '"' +
      (/^[=+@\-\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
      '"'
    )
  }
  const rows: (string | number)[][] = [
    [
      "Title",
      "Format",
      "Streams",
      "Distinct viewer accounts",
      "Watch hours",
      "Average viewing seconds",
      "Completion %",
    ],
    ...[...report.rows, ...report.episodes].map((row) => [
      row.title,
      row.contentType,
      row.streams,
      row.viewers,
      (row.watchSeconds / 3600).toFixed(3),
      row.averageSeconds.toFixed(1),
      row.completionRate.toFixed(1),
    ]),
  ]
  return rows.map((row) => row.map(cell).join(",")).join("\r\n")
}
