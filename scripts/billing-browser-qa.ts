import "dotenv/config"
import { chromium, expect as baseExpect } from "@playwright/test"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const base = process.env.BILLING_QA_URL ?? "http://localhost:3002"
const expect = baseExpect.configure({ timeout: 60000 })
const testUrl = process.env.TEST_DATABASE_URL
if (
  !testUrl ||
  new URL(testUrl).searchParams.get("schema") !== "ghanaverse_test" ||
  !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)
)
  throw new Error("Billing QA requires the isolated test schema")
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: testUrl },
    { schema: "ghanaverse_test" }
  ),
})
const output = "artifacts/implementation-qa/billing"
mkdirSync(output, { recursive: true })
const suffix = randomUUID(),
  email = `billing-qa-${suffix}@example.test`,
  password = `BillingQA-${randomUUID()}`
const checks: string[] = [],
  errors: string[] = []
const browser = await chromium.launch({
  ...(existsSync(chromium.executablePath()) ? {} : { channel: "msedge" }),
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
const page = await context.newPage()
page.setDefaultTimeout(60000)
page.on("pageerror", (e) => errors.push(e.message))
let userId: string | undefined
try {
  await page.goto(`${base}/plans`)
  await expect(
    page.getByRole("heading", { name: "GhanaVerse Premium Pass", exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("GHS 45.00", { exact: true }).first()
  ).toBeVisible()
  checks.push("Public pricing and prepaid terms render from persisted plan")
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({
      path: `${output}/plans-${width}.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
  }
  checks.push(
    "Plans responsive screenshots: 390, 768, 1024, 1440; no horizontal overflow"
  )
  const register = await context.request.post(
    `${base}/api/auth/sign-up/email`,
    {
      headers: { origin: base },
      data: { name: "Billing QA Viewer", email, password },
    }
  )
  if (!register.ok())
    throw new Error(`QA registration failed: ${register.status()}`)
  userId = (await db.user.findUniqueOrThrow({ where: { email } })).id
  await page.goto(`${base}/account`)
  await expect(
    page.getByRole("heading", { name: "Account & Subscription", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Free Access", { exact: true })).toBeVisible()
  await expect(page.getByText(email, { exact: true }).first()).toBeVisible()
  checks.push(
    "Registered account shows owned identity, free status, and actual profiles"
  )
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({
      path: `${output}/account-free-${width}.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
  }
  checks.push(
    "Account responsive screenshots: 390, 768, 1024, 1440; no horizontal overflow"
  )
  await page.getByRole("button", { name: "Edit Profile" }).click()
  await expect(
    page.getByRole("button", { name: "Save account details" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Close editor" }).click()
  await page.getByRole("button", { name: "Change", exact: true }).click()
  await expect(
    page.getByLabel("Current password", { exact: true })
  ).toBeVisible()
  await page.getByLabel("Current password", { exact: true }).fill(password)
  await page
    .getByLabel("New password", { exact: true })
    .fill("Example-password-123")
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("Different-password-123")
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click()
  await expect(
    page.getByText("Passwords do not match", { exact: true })
  ).toBeVisible()
  checks.push(
    "Existing identity editor and password validation remain functional"
  )
  // Persisted local fixtures exercise presentation, not provider success.
  const plan = await db.billingPlan.findUniqueOrThrow({
    where: { id: "premium" },
  })
  const payment = await db.billingPayment.create({
    data: {
      userId,
      planId: plan.id,
      reference: `qa-ui-${randomUUID()}`,
      idempotencyKey: randomUUID(),
      amount: plan.amount,
      mode: "test",
      email,
      channel: "card",
      status: "PENDING",
    },
  })
  await page.reload()
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Check payment", exact: true })
  ).toBeVisible()
  await db.billingPayment.update({
    where: { id: payment.id },
    data: { status: "FAILED" },
  })
  await page.reload()
  await expect(page.getByText("FAILED", { exact: true })).toBeVisible()
  await expect(page.getByText("Free Access", { exact: true })).toBeVisible()
  await db.billingPayment.update({
    where: { id: payment.id },
    data: { status: "SUCCESS", paidAt: new Date() },
  })
  const start = new Date(Date.now() - 86400000)
  const grant = await db.premiumGrant.create({
    data: {
      paymentId: payment.id,
      userId,
      mode: "test",
      startsAt: start,
      endsAt: new Date(start.getTime() + 30 * 86400000),
    },
  })
  await page.reload()
  await expect(page.getByText(/Active · Expires/)).toBeVisible()
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({
      path: `${output}/account-active-fixture-${width}.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
  }
  const receipt = page.getByRole("link", { name: "Receipt", exact: true })
  await receipt.focus()
  await expect(receipt).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("heading", { name: "Premium Pass Receipt" })
  ).toBeVisible()
  await expect(page.getByText(payment.reference, { exact: true })).toBeVisible()
  await page.screenshot({
    path: `${output}/receipt-fixture-1440.png`,
    fullPage: true,
  })
  await db.premiumGrant.update({
    where: { id: grant.id },
    data: {
      startsAt: new Date(Date.now() - 31 * 86400000),
      endsAt: new Date(Date.now() - 86400000),
    },
  })
  await page.goto(`${base}/account`)
  await expect(
    page.getByText("Expired · Renew access", { exact: true })
  ).toBeVisible()
  checks.push(
    "Persisted isolated fixtures render pending, failed, active and expired access; keyboard receipt navigation and responsive active layouts pass (provider success simulated)"
  )
  await page.goto(`${base}/plans/result?reference=forged-${suffix}`)
  await expect(
    page.getByRole("heading", { name: "Payment verification unavailable" })
  ).toBeVisible()
  await expect(
    page.getByText("Payment was not found.", { exact: true })
  ).toBeVisible()
  checks.push(
    "Forged browser callback displays verification failure without granting access"
  )
  const unauthorized = await context.request.get(`${base}/api/admin/billing`)
  expect(unauthorized.status()).toBe(403)
  const forged = await context.request.post(`${base}/api/webhooks/paystack`, {
    data: { event: "charge.success", data: {} },
    headers: { "x-paystack-signature": "0".repeat(128) },
  })
  expect(forged.status()).toBe(401)
  checks.push(
    "Viewer cannot access administrator billing; forged webhook rejected"
  )
  await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } })
  // Sign in again so the normal auth flow refreshes the role in the session.
  await context.request.post(`${base}/api/auth/sign-out`, {
    headers: { origin: base },
    data: {},
  })
  const login = await context.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { origin: base },
    data: { email, password },
  })
  expect(login.ok()).toBe(true)
  await page.goto(`${base}/admin/royalties`)
  await expect(
    page.getByRole("heading", { name: "Licensing & Payouts", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Premium Pass pricing" })
  ).toBeVisible()
  await page.screenshot({
    path: `${output}/admin-licensing-1440.png`,
    fullPage: true,
  })
  checks.push(
    "Administrator pricing, agreements, payout records and destinations render"
  )
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`)
} catch (error) {
  errors.push(error instanceof Error ? error.message : "Browser QA failed")
  throw error
} finally {
  await context.close()
  await browser.close()
  if (userId) {
    await db.premiumGrant.deleteMany({ where: { userId } })
    await db.billingPayment.deleteMany({ where: { userId } })
    await db.user.delete({ where: { id: userId } })
  }
  await db.$disconnect()
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ checks, errors }, null, 2)
  )
}
console.log(JSON.stringify({ checks, errors }, null, 2))
