import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { getPrisma, sqlTable } from "@/lib/prisma"
import { paymentConfiguration } from "@/lib/paystack"

export async function paymentReport(
  since: Date,
  end: Date,
  requestedPage: number
) {
  const { mode } = paymentConfiguration()
  const take = 20
  const db = getPrisma()
  // A full refund or chargeback changes status but does not erase the original
  // confirmed payment. Gross deliberately includes those original amounts.
  const confirmed: Prisma.BillingPaymentWhereInput = {
    mode: mode ?? "unconfigured",
    currency: "GHS",
    paidAt: { gte: since, lt: end },
    status: { in: ["SUCCESS", "REFUNDED", "CHARGEBACK"] },
  }
  const transactions: Prisma.BillingPaymentWhereInput = {
    mode: mode ?? "unconfigured",
    currency: "GHS",
    createdAt: { gte: since, lt: end },
  }
  const [summary, daily, total] = await Promise.all([
    db.billingPayment.aggregate({
      where: confirmed,
      _sum: { amount: true },
      _count: true,
    }),
    db.$queryRaw<{ day: string; amount: bigint; count: bigint }[]>(Prisma.sql`
      SELECT TO_CHAR("paidAt", 'YYYY-MM-DD') AS day, SUM(amount)::bigint AS amount, COUNT(*) AS count
      FROM ${sqlTable("BillingPayment")}
      WHERE mode = ${mode ?? "unconfigured"} AND currency = 'GHS'
        AND status IN ('SUCCESS', 'REFUNDED', 'CHARGEBACK') AND "paidAt" >= ${since} AND "paidAt" < ${end}
      GROUP BY day ORDER BY day`),
    db.billingPayment.count({ where: transactions }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / take))
  const page = Math.min(requestedPage, totalPages)
  const items = await db.billingPayment.findMany({
    where: transactions,
    take,
    skip: (page - 1) * take,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      reference: true,
      amount: true,
      channel: true,
      mobileMoneyNetwork: true,
      status: true,
      createdAt: true,
      paidAt: true,
      user: { select: { name: true, email: true } },
    },
  })
  return {
    mode,
    grossAmount: summary._sum.amount ?? 0,
    paidCount: summary._count,
    daily: daily.map((day) => ({
      day: day.day,
      amount: Number(day.amount),
      count: Number(day.count),
    })),
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      paidAt: item.paidAt?.toISOString() ?? null,
    })),
    total,
    page,
    totalPages,
  }
}
