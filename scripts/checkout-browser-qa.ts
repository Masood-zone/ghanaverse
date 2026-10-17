import "dotenv/config"
import { chromium, expect as baseExpect } from "@playwright/test"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const base = process.env.BILLING_QA_URL ?? "http://localhost:3002"
const testUrl = process.env.TEST_DATABASE_URL
if (
  !testUrl ||
  new URL(testUrl).searchParams.get("schema") !== "ghanaverse_test" ||
  !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)
)
  throw Error("Local isolated test database required")
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: testUrl },
    { schema: "ghanaverse_test" }
  ),
})
const browser = await chromium.launch({
  ...(existsSync(chromium.executablePath()) ? {} : { channel: "msedge" }),
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
const page = await context.newPage()
const expect = baseExpect.configure({ timeout: 45000 })
const output = "artifacts/implementation-qa/checkout"
mkdirSync(output, { recursive: true })
const checks: string[] = [],
  errors: string[] = []
page.on("pageerror", (error) => errors.push(error.message))
const email = `checkout-qa-${randomUUID()}@example.test`,
  password = `Checkout-${randomUUID()}`
let userId: string | undefined
try {
  await page.goto(`${base}/plans`)
  await expect(
    page.getByRole("link", { name: "Make payment", exact: true })
  ).toBeVisible()
  await expect(
    page.getByLabel("Mobile Money number", { exact: true })
  ).toHaveCount(0)
  await page.getByRole("link", { name: "Make payment", exact: true }).click()
  await expect(page).toHaveURL(/\/auth\?callbackUrl=/)
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
    "/plans?step=payment"
  )
  const register = await context.request.post(
    `${base}/api/auth/sign-up/email`,
    {
      headers: { origin: base },
      data: { name: "Checkout QA", email, password },
    }
  )
  expect(register.ok()).toBe(true)
  userId = (await db.user.findUniqueOrThrow({ where: { email } })).id
  await context.request.post(`${base}/api/auth/sign-out`, {
    headers: { origin: base },
    data: {},
  })
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await expect(page).toHaveURL(`${base}/plans?step=payment`)
  await expect(
    page.getByRole("heading", { name: "Payment details", exact: true })
  ).toBeVisible()
  await expect(page.getByLabel("Account billing email")).toHaveValue(email)
  checks.push(
    "Step 1 has no payment fields; Make payment requires sign-in and real sign-in returns to step 2"
  )
  const pay = page.getByRole("button", {
    name: "Continue to Paystack",
    exact: true,
  })
  await pay.click()
  await expect(page.locator("#payer-phone-error")).toContainText(
    "valid Ghanaian"
  )
  await expect(
    page.getByLabel("Mobile Money number", { exact: true })
  ).toBeFocused()
  await page.getByLabel("Mobile Money number", { exact: true }).fill("1234")
  await pay.click()
  await expect(page.locator("#payer-phone-error")).toContainText(
    "valid Ghanaian"
  )
  await page.getByRole("radio", { name: "Card", exact: true }).check()
  await expect(
    page.getByLabel("Mobile Money number", { exact: true })
  ).toHaveCount(0)
  await page.getByRole("radio", { name: "MTN MoMo", exact: true }).check()
  await page.keyboard.press("ArrowRight")
  await expect(
    page.getByRole("radio", { name: "Telecel Cash", exact: true })
  ).toBeChecked()
  await page
    .getByLabel("Mobile Money number", { exact: true })
    .fill("+233 24 123 4567")
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage })
    )
  ).not.toContain("241234567")
  expect(page.url()).not.toContain("241234567")
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({
      path: `${output}/payment-${width}.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
  }
  const logos = page.locator(".gv-checkout-logo")
  expect(
    await logos.evaluateAll((images) =>
      images.every(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0
      )
    )
  ).toBe(true)
  await page
    .getByRole("link", { name: "Back to choose your pass", exact: false })
    .click()
  await expect(page).toHaveURL(`${base}/plans`)
  await expect(
    page.getByRole("heading", { name: "GhanaVerse Premium Pass", exact: true })
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole("heading", { name: "Payment details", exact: true })
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Payment details", exact: true })
  ).toBeVisible()
  await expect(
    page.getByLabel("Mobile Money number", { exact: true })
  ).toHaveValue("")
  checks.push(
    "Conditional fields, invalid Ghana numbers, accessible radios, Back/refresh, phone privacy, local logos and desktop/mobile layout pass"
  )
  const invalid = await context.request.post(`${base}/api/billing/checkout`, {
    headers: { origin: base },
    data: {
      channel: "mobile_money",
      idempotencyKey: randomUUID(),
      mobileMoneyNetwork: "mtn",
      payerPhone: "1234",
    },
  })
  expect(invalid.status()).toBe(400)
  const reference = `checkout-fixture-${randomUUID()}`
  const payment = await db.billingPayment.create({
    data: {
      userId,
      planId: "premium",
      reference,
      mode: "test",
      amount: 4500,
      channel: "card",
      email,
      idempotencyKey: randomUUID(),
      checkoutUrl: "https://checkout.paystack.com/fixture-only",
    },
  })
  let status = "PENDING",
    active = false,
    renewal = false,
    unavailable = false,
    verificationCalls = 0
  const expiry = new Date(Date.now() + 30 * 86400000)
  // Presentation fixtures only. Real verification/provider mismatch and grants are covered by billing tests.
  await page.route("**/api/billing/verify", async (route) => {
    verificationCalls++
    await route.fulfill({
      status: unavailable ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        unavailable
          ? {
              success: false,
              message: "Provider unavailable",
              code: "PROVIDER_UNCERTAIN",
            }
          : {
              success: true,
              data: {
                reference,
                status,
                amount: 4500,
                days: 30,
                active,
                renewal,
                access: {
                  active,
                  expiresAt: active ? expiry.toISOString() : null,
                },
              },
            }
      ),
    })
  })
  let releaseInitialization: (() => void) | undefined
  let initializationCalls = 0
  const initializationGate = new Promise<void>((resolve) => {
    releaseInitialization = resolve
  })
  await page.route("**/api/billing/checkout", async (route) => {
    initializationCalls++
    const body = route.request().postDataJSON()
    expect(body.mobileMoneyNetwork).toBe("mtn")
    expect(body.payerPhone).toBe("+233241234567")
    await initializationGate
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          reference,
          url: `${base}/plans?step=payment&reference=${reference}`,
        },
      }),
    })
  })
  await page
    .getByLabel("Mobile Money number", { exact: true })
    .fill("+233 24 123 4567")
  await pay.click()
  await expect(
    page.getByRole("button", { name: "Opening Paystack…" })
  ).toBeDisabled()
  await page
    .locator("form[novalidate]")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit())
  expect(initializationCalls).toBe(1)
  releaseInitialization!()
  await expect(page).toHaveURL(
    `${base}/plans?step=payment&reference=${reference}`
  )
  await expect(
    page.getByText("Your previous payment is still pending", { exact: true })
  ).toBeVisible()
  await expect(pay).toBeDisabled()
  checks.push(
    "Selected provider and normalized phone reach initialization; duplicate submits stay disabled until redirect (initialization response simulated)"
  )
  await expect(
    page.getByRole("link", { name: "Resume existing checkout" })
  ).toHaveAttribute("href", payment.checkoutUrl!)
  await page.goto(`${base}/plans/result?trxref=${reference}`)
  await expect(
    page.getByRole("heading", { name: "Your payment is still pending" })
  ).toBeVisible()
  const calls = verificationCalls
  await page.getByRole("link", { name: "Account & subscription", exact: true }).focus()
  await expect(
    page.getByRole("link", { name: "Account & subscription", exact: true })
  ).toBeFocused()
  expect(verificationCalls).toBe(calls)
  status = "FAILED"
  await page.getByRole("button", { name: "Check payment status" }).click()
  await expect(
    page.getByRole("heading", { name: "Your payment was unsuccessful" })
  ).toBeVisible()
  unavailable = true
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Payment verification unavailable" })
  ).toBeVisible()
  unavailable = false
  status = "SUCCESS"
  active = true
  await db.billingPayment.update({
    where: { id: payment.id },
    data: { status, paidAt: new Date() },
  })
  await db.premiumGrant.create({
    data: {
      userId,
      paymentId: payment.id,
      mode: "test",
      startsAt: new Date(Date.now() - 1000),
      endsAt: expiry,
    },
  })
  await page.getByRole("button", { name: "Check payment status" }).click()
  await expect(
    page.getByRole("heading", {
      name: "Welcome to the exclusive side of GhanaVerse",
    })
  ).toBeVisible()
  await expect(page.getByText("GHS 45.00", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Start exploring" })
  ).toBeVisible()
  await page.screenshot({ path: `${output}/success-1440.png`, fullPage: true })
  await page.getByRole("link", { name: "View receipt", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Premium Pass Receipt" })
  ).toBeVisible()
  renewal = true
  await page.goto(`${base}/plans/result?reference=${reference}`)
  await expect(
    page.getByRole("heading", { name: "Your Premium access has been extended" })
  ).toBeVisible()
  active = false
  await page.reload()
  await expect(
    page.getByRole("heading", {
      name: "This payment no longer provides active access",
    })
  ).toBeVisible()
  await page.goto(`${base}/plans/result`)
  await expect(
    page.getByRole("heading", { name: "Payment reference missing" })
  ).toBeVisible()
  checks.push(
    "Presentation fixtures cover cancellation recovery, trxref callback, pending/manual check, failure, unavailable verification, verified welcome/receipt, renewal and expired/missing-reference states"
  )
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await guestPage.goto(`${base}/plans/result?trxref=${reference}`)
  expect(new URL(guestPage.url()).searchParams.get("callbackUrl")).toBe(
    `/plans/result?reference=${reference}`
  )
  await guest.close()
  checks.push("Callback reference survives authentication restoration")
  if (errors.length) throw Error(errors.join("; "))
} catch (error) {
  errors.push(error instanceof Error ? error.message : "Browser QA failed")
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true })
  throw error
} finally {
  await browser.close()
  if (userId) {
    await db.premiumGrant.deleteMany({ where: { userId } })
    await db.billingPayment.deleteMany({ where: { userId } })
    await db.user.delete({ where: { id: userId } })
  }
  await db.$disconnect()
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ checks, errors, providerSuccessSimulated: true }, null, 2)
  )
}
console.log(
  JSON.stringify({ checks, errors, providerSuccessSimulated: true }, null, 2)
)
