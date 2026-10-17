import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest"
import { randomUUID } from "node:crypto"
import { getPrisma } from "@/lib/prisma"
import { handleBilling } from "@/services/billing/handler"
import { POST as webhook } from "@/app/api/webhooks/paystack/route"
import { ensurePlan } from "@/services/billing/payments"
const db = getPrisma(),
  suffix = randomUUID(),
  viewer = `billing-http-v-${suffix}`,
  admin = `billing-http-a-${suffix}`
let actor = viewer,
  reference: string
const originalKey = process.env.PAYSTACK_SECRET_KEY
let beforePlan: Awaited<ReturnType<typeof ensurePlan>>
vi.mock("@/lib/auth/access", async (original) => {
  const actual = await original<typeof import("@/lib/auth/access")>()
  return {
    ...actual,
    requireUser: async () => {
      const user = await getPrisma().user.findUniqueOrThrow({
        where: { id: actor },
      })
      return { user }
    },
  }
})
const request = (
  path: string,
  method = "GET",
  body?: unknown,
  origin = "http://localhost:3000"
) =>
  handleBilling(
    new Request(`http://localhost:3000/api/${path}`, {
      method,
      headers: { origin, "content-type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    })
  )
beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_http_fixture"
  beforePlan = await ensurePlan()
  await db.user.createMany({
    data: [
      { id: viewer, name: "HTTP Viewer", email: `${viewer}@example.test` },
      {
        id: admin,
        name: "HTTP Admin",
        email: `${admin}@example.test`,
        role: "ADMIN",
      },
    ],
  })
  reference = `gv-http-${suffix}`
  await db.billingPayment.create({
    data: {
      userId: viewer,
      planId: "premium",
      reference,
      idempotencyKey: randomUUID(),
      amount: 4500,
      mode: "test",
      email: `${viewer}@example.test`,
      channel: "card",
    },
  })
})
afterEach(async () => {
  actor = viewer
  await db.user.update({ where: { id: viewer }, data: { isSuspended: false } })
})
afterAll(async () => {
  await db.billingPayment.deleteMany({ where: { userId: viewer } })
  await db.user.deleteMany({ where: { id: { in: [viewer, admin] } } })
  await db.auditLog.deleteMany({ where: { actorId: admin } })
  await db.billingPlan.update({
    where: { id: "premium" },
    data: {
      amount: beforePlan.amount,
      enabled: beforePlan.enabled,
      commercialConfirmed: beforePlan.commercialConfirmed,
    },
  })
  process.env.PAYSTACK_SECRET_KEY = originalKey
})
describe("billing HTTP boundaries", () => {
  it("exposes public plans without private payment data and uses private caching", async () => {
    const response = await request("billing/plans")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    const { data } = await response.json()
    expect(data.payments).toEqual([])
    expect(data.access.active).toBe(false)
    expect(JSON.stringify(data)).not.toContain("sk_test_http_fixture")
  })
  it("returns owned receipts and hides other accounts' receipts", async () => {
    const own = await request(`billing/receipt/${reference}`)
    expect(own.status).toBe(200)
    const text = await own.text()
    expect(text).toContain(reference)
    expect(text).not.toContain("checkoutUrl")
    expect(text).not.toContain("providerId")
    actor = admin
    expect((await request(`billing/receipt/${reference}`)).status).toBe(404)
  })
  it("rejects viewer access to admin money operations and creator statements", async () => {
    expect((await request("admin/billing")).status).toBe(403)
    expect(
      (await request("admin/billing/plan", "PATCH", { amount: 1 })).status
    ).toBe(403)
    expect((await request("creator/earnings")).status).toBe(403)
  })
  it("rejects cross-origin mutations, invalid fields and malformed JSON", async () => {
    expect(
      (
        await request(
          "billing/checkout",
          "POST",
          { channel: "card", idempotencyKey: randomUUID() },
          "https://foreign.invalid"
        )
      ).status
    ).toBe(403)
    expect(
      (
        await request("billing/checkout", "POST", {
          amount: 1,
          channel: "card",
          idempotencyKey: randomUUID(),
        })
      ).status
    ).toBe(400)
    const malformed = await handleBilling(
      new Request("http://localhost:3000/api/billing/verify", {
        method: "POST",
        body: "{",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
      })
    )
    expect(malformed.status).toBe(400)
  })
  it("checks current suspension instead of trusting the session", async () => {
    await db.user.update({ where: { id: viewer }, data: { isSuspended: true } })
    expect((await request("billing")).status).toBe(401)
  })
  it("allows admin price changes but preserves old orders", async () => {
    actor = admin
    const result = await request("admin/billing/plan", "PATCH", {
      amount: 4900,
      enabled: true,
      commercialConfirmed: false,
    })
    expect(result.status).toBe(200)
    expect(
      (await db.billingPayment.findUniqueOrThrow({ where: { reference } }))
        .amount
    ).toBe(4500)
    expect(
      (await db.billingPlan.findUniqueOrThrow({ where: { id: "premium" } }))
        .amount
    ).toBe(4900)
  })
  it("rejects forged or oversized webhook deliveries", async () => {
    const invalid = await webhook(
      new Request("http://localhost:3000/api/webhooks/paystack", {
        method: "POST",
        body: "{}",
        headers: { "x-paystack-signature": "0".repeat(128) },
      })
    )
    expect(invalid.status).toBe(401)
    const large = await webhook(
      new Request("http://localhost:3000/api/webhooks/paystack", {
        method: "POST",
        body: "{}",
        headers: { "content-length": "999999" },
      })
    )
    expect(large.status).toBe(413)
  })
  it("requires the current adjustment snapshot before acknowledging a partial refund", async () => {
    actor = admin
    const payment = await db.billingPayment.update({
      where: { reference },
      data: { refundAmount: 1000, reviewRequired: true },
    })
    expect(
      (
        await request(`admin/billing/reviews/${payment.id}`, "POST", {
          refundAmount: 900,
        })
      ).status
    ).toBe(409)
    expect(
      (await db.billingPayment.findUniqueOrThrow({ where: { reference } }))
        .reviewRequired
    ).toBe(true)
    expect(
      (
        await request(`admin/billing/reviews/${payment.id}`, "POST", {
          refundAmount: 1000,
        })
      ).status
    ).toBe(200)
    expect(
      (await db.billingPayment.findUniqueOrThrow({ where: { reference } }))
        .reviewRequired
    ).toBe(false)
  })
})
