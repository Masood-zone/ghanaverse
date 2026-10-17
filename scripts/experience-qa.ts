import "dotenv/config"
import { chromium, expect as baseExpect } from "@playwright/test"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const base = process.env.EXPERIENCE_QA_URL ?? "http://localhost:3002"
const testUrl = process.env.TEST_DATABASE_URL
if (
  !testUrl ||
  new URL(testUrl).searchParams.get("schema") !== "ghanaverse_test" ||
  !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)
)
  throw new Error(
    "Experience QA requires the isolated test schema and a local server"
  )
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: testUrl },
    { schema: "ghanaverse_test" }
  ),
})
const output = "artifacts/implementation-qa/experience"
mkdirSync(output, { recursive: true })
const baseline = process.argv.includes("--baseline")
const prefix = baseline ? "before" : "after"
const expect = baseExpect.configure({ timeout: 60000 })
const suffix = randomUUID()
const ids: string[] = []
const errors: string[] = []
const checks: string[] = []
const browser = await chromium.launch({
  ...(existsSync(chromium.executablePath()) ? {} : { channel: "msedge" }),
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 390, height: 1000 },
})
const page = await context.newPage()
page.setDefaultNavigationTimeout(120000)
page.on("pageerror", (error) => errors.push(error.message))
page.on("console", (message) => {
  if (
    message.type() === "error" &&
    /hydration|hydrated|does not match|Minified React error/i.test(
      message.text()
    )
  )
    errors.push(message.text())
})
let throttleNavigation = false
await page.route("**/*", async (route) => {
  const headers = route.request().headers()
  // Keep a production-prefetched page from hiding the intentionally slow test.
  if (headers["next-router-prefetch"] === "1") {
    await route.abort()
    return
  }
  if (throttleNavigation && headers["rsc"] === "1")
    await new Promise((resolve) => setTimeout(resolve, 1200))
  await route.continue()
})
let userId: string | undefined
try {
  for (const [index, title] of [
    "Across Accra: A Very Long Ghanaian Story About Family, Homecoming and the People We Remember",
    "A Story Without Artwork",
    "GhanaVerse Cinema",
  ].entries()) {
    const content = await db.content.create({
      data: {
        slug: `experience-${suffix}-${index}`,
        title,
        shortDescription:
          "An isolated browser fixture for responsive layout and keyboard controls.",
        description: "A local QA fixture, removed after this verification run.",
        contentType: "MOVIE",
        publicationStatus: "PUBLISHED",
        isFeatured: true,
        classification: null,
        releaseYear: 2026,
        publishedAt: new Date(Date.UTC(2099, 0, 3 - index)),
        backdropUrl: index === 1 ? null : "/images/subscription-director.jpg",
        posterUrl: index === 1 ? null : "/images/fallback-poster.svg",
        ...(index === 0
          ? {
              trailer: {
                create: {
                  youtubeVideoId: "dQw4w9WgXcQ",
                  title: "Local trailer fixture",
                },
              },
            }
          : {}),
      },
    })
    ids.push(content.id)
  }
  await page.goto(base)
  const hero = page.getByRole("region", { name: "Featured GhanaVerse titles" })
  // A labelled section exposes a region in the accessibility tree.
  await expect(hero).toBeVisible()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(async () => {
      await document.fonts.ready
      window.scrollTo(0, 0)
    })
    await page.screenshot({
      path: `${output}/${prefix}-home-${width}.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
    if (!baseline && width < 768) {
      const heading = hero.getByRole("heading", { level: 1 })
      const size = await heading.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize)
      )
      expect(size).toBeGreaterThanOrEqual(28)
      expect(size).toBeLessThanOrEqual(32)
    }
  }
  checks.push(
    "Home screenshots at 320, 390, 768, 1440 with no horizontal overflow"
  )
  if (!baseline) {
    await page.setViewportSize({ width: 390, height: 1000 })
    const next = hero.getByRole("button", { name: /next/i }).last()
    await next.click()
    await expect(
      hero.getByRole("heading", {
        name: "A Story Without Artwork",
        exact: true,
      })
    ).toBeVisible()
    await expect
      .poll(() =>
        hero
          .locator("img")
          .first()
          .evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0
          )
      )
      .toBe(true)
    await page.screenshot({
      path: `${output}/after-missing-artwork-390.png`,
      fullPage: true,
    })
    await next.press("ArrowLeft")
    await expect(
      hero.getByRole("heading", { name: /^Across Accra:/ })
    ).toBeVisible()
    checks.push(
      "Next button, keyboard previous navigation, complete long title and missing-artwork fallback"
    )
    await page.emulateMedia({ reducedMotion: "reduce" })
    await hero.getByRole("button", { name: "Play featured rotation" }).click()
    await page.locator("header a").first().focus()
    await page.mouse.move(1, 1)
    await page.screenshot({
      path: `${output}/after-reduced-motion-390.png`,
      fullPage: true,
    })
    const heading = await hero.getByRole("heading", { level: 1 }).textContent()
    await page.waitForTimeout(7500)
    expect(await hero.getByRole("heading", { level: 1 }).textContent()).toBe(
      heading
    )
    checks.push(
      "Reduced motion keeps hero stable beyond its seven-second rotation period"
    )
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.route("https://www.youtube-nocookie.com/**", (route) =>
      route.fulfill({
        body: "<html><body>Local trailer fixture</body></html>",
        contentType: "text/html",
      })
    )
    await hero
      .getByRole("button", { name: "Watch Trailer", exact: true })
      .click()
    await expect(page.getByRole("dialog", { name: /trailer$/ })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: /trailer$/ })).toBeHidden()
    checks.push(
      "Trailer opens accessibly and closes with Escape; external player is stubbed for local QA"
    )

    // Delay actual RSC responses to exercise pending transitions and route fallbacks.
    throttleNavigation = true
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page
      .getByRole("link", { name: "Browse / Catalogue", exact: true })
      .first()
      .click()
    const bar = page.getByRole("progressbar", { name: /loading/i })
    await expect(bar).toBeVisible()
    await page.screenshot({
      path: `${output}/after-navigation-pending-1440.png`,
      fullPage: true,
    })
    await expect(page).toHaveURL(/\/browse/)
    await expect(bar).toBeHidden()
    await page.screenshot({
      path: `${output}/after-browse-1440.png`,
      fullPage: true,
    })
    await page
      .getByRole("link", { name: "Search", exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/search/)
    await expect(bar).toBeHidden()
    await page.goBack()
    await expect(page).toHaveURL(/\/browse/)
    await expect(bar).toBeHidden()
    await page.goForward()
    await expect(page).toHaveURL(/\/search/)
    await expect(bar).toBeHidden()
    await page
      .getByRole("link", { name: "Movies", exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(/type=MOVIE/)
    await expect(bar).toBeHidden()
    await page
      .getByRole("link", { name: "Home", exact: true })
      .first()
      .click({ noWaitAfter: true })
    await page
      .getByRole("link", { name: "Pricing", exact: true })
      .first()
      .click({ noWaitAfter: true })
    await expect(page).toHaveURL(/\/plans/)
    await expect(bar).toBeHidden()
    checks.push(
      "Throttled link, query-string and rapid successive navigation show pending feedback and settle after navigation/back/forward"
    )
    await page.unroute("**/*")
    const email = `experience-${suffix}@example.test`
    const password = `Experience-${randomUUID()}`
    const registration = await context.request.post(
      `${base}/api/auth/sign-up/email`,
      {
        headers: { origin: base },
        data: { email, password, name: "Experience QA" },
      }
    )
    expect(registration.ok()).toBe(true)
    userId = (await db.user.findUniqueOrThrow({ where: { email } })).id
    await page.goto(`${base}/account`)
    await expect(
      page.getByRole("heading", { name: "Account & Subscription" })
    ).toBeVisible()
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.screenshot({
        path: `${output}/after-account-${width}.png`,
        fullPage: true,
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      ).toBe(true)
    }
    checks.push("Authenticated account responsive at all four widths")
    await page.getByLabel("Phone number (optional)").fill("0241234567")
    await page
      .getByRole("button", { name: "Save phone settings", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "Send verification code", exact: true })
    ).toBeVisible()
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: userId } })).phone
    ).toBe("+233241234567")
    const consent = await context.request.patch(`${base}/api/account/phone`, {
      headers: { origin: base },
      data: { phone: "0241234567", transactionalSmsConsent: true },
    })
    expect(consent.status()).toBe(409)
    checks.push(
      "Account phone normalization and server rejection of unverified SMS consent; no live code requested"
    )
    await page.goto(`${base}/title/experience-${suffix}-0`)
    await expect(
      page.getByRole("heading", { name: /^Across Accra:/ }).first()
    ).toBeVisible()
    await page.screenshot({
      path: `${output}/after-title-1440.png`,
      fullPage: true,
    })
    await page.goto(`${base}/title/not-a-real-title-${suffix}`)
    await expect(
      page.getByRole("progressbar", { name: /loading/i })
    ).toBeHidden()
    checks.push(
      "Title details and missing-title navigation settle without a stuck loading bar"
    )
    await page.goto(`${base}/admin/notifications`)
    await expect(page).toHaveURL(`${base}/`)
    await expect(
      page.getByRole("progressbar", { name: /loading/i })
    ).toBeHidden()
    checks.push(
      "Unauthorized administrator redirect settles without a stuck loading bar"
    )
    await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } })
    await page.goto(`${base}/admin/notifications`)
    await expect(
      page.getByRole("heading", { name: "Transactional Notifications" })
    ).toBeVisible()
    await page.getByLabel("Delivery state").selectOption("PENDING")
    await expect(
      page.getByRole("cell", { name: "Experience QA", exact: true }).first()
    ).toBeVisible()
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.screenshot({
        path: `${output}/after-notifications-${width}.png`,
        fullPage: true,
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      ).toBe(true)
    }
    checks.push(
      "Administrator queue displays persisted welcome event and is responsive at 320/1440"
    )
  }
  expect(errors).toEqual([])
  writeFileSync(
    `${output}/${prefix}-results.json`,
    JSON.stringify({ checks, errors }, null, 2)
  )
  console.log(JSON.stringify({ checks, errors, output }, null, 2))
} finally {
  await browser.close()
  if (userId) await db.user.delete({ where: { id: userId } })
  await db.content.deleteMany({ where: { id: { in: ids } } })
  await db.$disconnect()
}
