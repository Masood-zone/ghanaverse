import "dotenv/config"
import { chromium, expect as baseExpect } from "@playwright/test"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
const base = process.env.BILLING_QA_URL ?? "http://localhost:3002"
if (!process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_"))
  throw new Error("Provider QA refuses live keys")
const testUrl = process.env.TEST_DATABASE_URL
if (
  !testUrl ||
  new URL(testUrl).searchParams.get("schema") !== "ghanaverse_test" ||
  !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)
)
  throw new Error("Provider QA requires local app and isolated test database")
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: testUrl },
    { schema: "ghanaverse_test" }
  ),
})
const output = "artifacts/implementation-qa/billing"
mkdirSync(output, { recursive: true })
const email = `provider-qa-${randomUUID()}@example.com`,
  password = `QA-${randomUUID()}`
const expect = baseExpect.configure({ timeout: 60000 })
const browser = await chromium.launch({
  ...(existsSync(chromium.executablePath()) ? {} : { channel: "msedge" }),
  headless: !process.argv.includes("--headed"),
})
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage()
page.setDefaultTimeout(45000)
let userId: string | undefined
const checks: string[] = []
try {
  const register = await context.request.post(
    `${base}/api/auth/sign-up/email`,
    {
      headers: { origin: base },
      data: { name: "Provider QA Viewer", email, password },
    }
  )
  expect(register.ok()).toBe(true)
  userId = (await db.user.findUniqueOrThrow({ where: { email } })).id
  const summary = await (
    await context.request.get(`${base}/api/billing`)
  ).json()
  if (summary.data.configuration.mode !== "test")
    throw new Error("App is not in Paystack test mode")
  const init = await context.request.post(`${base}/api/billing/checkout`, {
    headers: { origin: base },
    data: { channel: "card", idempotencyKey: randomUUID() },
  })
  const initialized = await init.json()
  if (!init.ok())
    throw new Error(`Hosted initialization failed: ${initialized.message}`)
  checks.push(
    "Real Paystack test API initialized hosted checkout for an isolated QA account"
  )
  const destination = new URL(initialized.data.url)
  expect(destination.hostname).toBe("checkout.paystack.com")
  await page.goto(destination.href, { waitUntil: "domcontentloaded" })
  if (
    /verify you are human|just a moment|performing security verification|cloudflare/i.test(
      await page.locator("body").innerText()
    )
  )
    throw new Error(
      "Hosted checkout is blocked by Paystack/Cloudflare human verification. No payment or callback completed."
    )
  await page
    .locator('input:not([type="hidden"])')
    .first()
    .waitFor({ state: "visible", timeout: 60000 })
  await page.screenshot({
    path: `${output}/paystack-checkout-test.png`,
    fullPage: true,
  })
  const inputs = await page.locator("input").evaluateAll((nodes) =>
    nodes
      .filter((n): n is HTMLInputElement => n instanceof HTMLInputElement)
      .map((n) => ({
        type: n.type,
        placeholder: n.placeholder,
        name: n.name,
        id: n.id,
      }))
  )
  writeFileSync(
    `${output}/provider-inputs.json`,
    JSON.stringify(
      { inputs, text: await page.locator("body").innerText() },
      null,
      2
    )
  )
  if (process.argv.includes("--inspect")) {
    console.log(JSON.stringify({ checks, inputs }, null, 2))
  } else {
    await page.getByPlaceholder(/card number/i).fill("4084084084084081")
    await page.getByPlaceholder(/mm\s*\/\s*yy/i).fill("1230")
    await page.getByPlaceholder(/cvv/i).fill("408")
    await page.getByRole("button", { name: /pay.*45/i }).click()
    await expect(page).toHaveURL(
      new RegExp(`${base.replaceAll(".", "\\.")}/plans/result`),
      { timeout: 60000 }
    )
    await expect(
      page.getByRole("heading", {
        name: "Welcome to the exclusive side of GhanaVerse",
      })
    ).toBeVisible()
    checks.push(
      "Official Paystack test card completed checkout and server verification granted access"
    )
    const grants = await db.premiumGrant.findMany({ where: { userId } })
    expect(grants.length).toBe(1)
    expect(grants[0].endsAt.getTime() - grants[0].startsAt.getTime()).toBe(
      30 * 86400000
    )
    await page.goto(`${base}/account`)
    await expect(page.getByText(/Active · Expires/)).toBeVisible()
    await page.screenshot({
      path: `${output}/account-active-1440.png`,
      fullPage: true,
    })
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.screenshot({
        path: `${output}/account-active-${width}.png`,
        fullPage: true,
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      ).toBe(true)
    }
    await page.getByRole("link", { name: "Receipt", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: "Premium Pass Receipt" })
    ).toBeVisible()
    checks.push(
      "Actual test payment appears in owned billing history, active access, and printable receipt"
    )
    writeFileSync(
      `${output}/provider-results.json`,
      JSON.stringify({ checks, mode: "test", realSettlement: false }, null, 2)
    )
    console.log(
      JSON.stringify({ checks, mode: "test", realSettlement: false }, null, 2)
    )
  }
} catch (error) {
  const providerText = await page
    .locator("body")
    .innerText()
    .catch(() => "")
  const blocker =
    /verify you are human|performing security verification|cloudflare/i.test(
      providerText
    )
      ? "Paystack hosted checkout requires Cloudflare human verification. Test initialization succeeded; payment completion and callback remain unverified."
      : error instanceof Error
        ? error.message
        : "Provider QA failed"
  await page
    .screenshot({ path: `${output}/provider-failure.png`, fullPage: true })
    .catch(() => undefined)
  writeFileSync(
    `${output}/provider-results.json`,
    JSON.stringify(
      {
        checks,
        mode: "test",
        realSettlement: false,
        error: blocker,
      },
      null,
      2
    )
  )
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
}
