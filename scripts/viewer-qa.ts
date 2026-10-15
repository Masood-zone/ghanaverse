import "dotenv/config"
import { chromium, expect as baseExpect } from "@playwright/test"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"
import { randomBytes } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
const expect = baseExpect.configure({ timeout: 60000 })
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  }),
})
const suffix = Date.now(),
  email = `qa-viewer-${suffix}@example.test`,
  password = randomBytes(18).toString("base64url"),
  title = `QA Viewer Story ${suffix}`
const output = "artifacts/implementation-qa"
mkdirSync(output, { recursive: true })
const checks: string[] = [],
  errors: string[] = []
async function main() {
  const browser = await chromium.launch({
    executablePath: chromium.executablePath(),
    headless: true,
    args: ["--no-proxy-server"],
  })
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage()
  page.setDefaultTimeout(60000)
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("dialog", (dialog) => dialog.accept())
  let contentId: string | undefined
  let creatorId: string | undefined
  try {
    await page.goto(
      "http://localhost:3000/auth?mode=register&callbackUrl=%2Fprofiles"
    )
    if (
      await page
        .getByRole("button", { name: "New here? Create an account" })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "New here? Create an account" })
        .click()
    await page.getByLabel("Full name", { exact: true }).fill("QA Viewer")
    await page.getByLabel("Email address", { exact: true }).fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByLabel("Confirm password", { exact: true }).fill(password)
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click()
    await expect(
      page.getByRole("heading", { name: "Who's watching?" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Select My Profile", exact: true })
    ).toBeVisible()
    expect(
      (
        await context.request.get("http://localhost:3000/api/admin/users")
      ).status()
    ).toBe(403)
    checks.push(
      "viewer registration, default profile and denied administrator access"
    )
    await page
      .getByRole("button", { name: "Manage Profiles", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Edit My Profile", exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByLabel("Profile name", { exact: true })
      .fill("QA Primary Profile")
    await page.getByRole("button", { name: "coast", exact: true }).click()
    await page
      .getByRole("button", { name: "Save Profile", exact: true })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await expect(
      page.getByRole("heading", { name: "QA Primary Profile", exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: /^Add Profile/ }).click()
    await page
      .getByRole("dialog")
      .getByLabel("Profile name", { exact: true })
      .fill("QA Reading Profile")
    await page
      .getByRole("button", { name: "Save Profile", exact: true })
      .click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await page.reload()
    await expect(
      page.getByRole("button", {
        name: "Select QA Reading Profile",
        exact: true,
      })
    ).toBeVisible()
    await page.screenshot({
      path: `${output}/viewer-profiles-390.png`,
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Select QA Reading Profile", exact: true })
      .click()
    await expect(page).toHaveURL("http://localhost:3000/")
    await page.goto("http://localhost:3000/account")
    await expect(
      page.getByText("Active profile: QA Reading Profile", { exact: true })
    ).toBeVisible()
    await page.screenshot({
      path: `${output}/viewer-account-390.png`,
      fullPage: true,
    })
    checks.push(
      "RHF profile editing, avatar, refresh persistence and account query"
    )
    const [genre, language] = await Promise.all([
      db.genre.findUniqueOrThrow({ where: { slug: "drama" } }),
      db.language.findUniqueOrThrow({ where: { code: "en" } }),
    ])
    const creator = await db.person.create({
      data: { name: `QA Viewer Creator ${suffix}` },
    })
    creatorId = creator.id
    const content = await db.content.create({
      data: {
        title,
        slug: `qa-viewer-${suffix}`,
        shortDescription: "Temporary viewer acceptance record",
        description: "Removed after browser verification",
        contentType: "MOVIE",
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        classification: "PG",
        genres: { create: { genreId: genre.id } },
        languages: { create: { languageId: language.id } },
        credits: { create: { personId: creator.id, creditType: "CREATOR" } },
        posterUrl: "/images/fallback-poster.svg",
        attributionNotes: "PRIVATE QA NOTES",
        sourcePayload: { private: "PRIVATE QA SOURCE" },
      },
    })
    contentId = content.id
    await page.goto(`http://localhost:3000/title/${content.slug}`)
    await page
      .getByRole("button", { name: "Add to My List", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "In My List", exact: true })
    ).toBeVisible()
    await page.goto("http://localhost:3000/library")
    await expect(
      page.getByRole("heading", { name: title, exact: true })
    ).toBeVisible()
    const library = await context.request.get(
      "http://localhost:3000/api/viewer/library"
    )
    expect(library.status()).toBe(200)
    expect(await library.text()).not.toContain("PRIVATE QA")
    await page.screenshot({
      path: `${output}/viewer-library-390.png`,
      fullPage: true,
    })
    checks.push(
      "watchlist mutation, library invalidation and private-data-safe response"
    )
    await page.goto(`http://localhost:3000/title/${content.slug}`)
    await page.getByRole("button", { name: "In My List", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Add to My List", exact: true })
    ).toBeVisible()
    await page.goto("http://localhost:3000/library")
    await expect(
      page.getByRole("heading", {
        name: "Your list is ready for its first story",
      })
    ).toBeVisible()
    expect(
      (
        await context.request.post(
          "http://localhost:3000/api/profiles/select",
          { data: { profileId: "not-owned" } }
        )
      ).status()
    ).toBe(404)
    await page.goto("http://localhost:3000/account")
    await page
      .getByRole("button", { name: "Sign Out", exact: true })
      .last()
      .click()
    await expect(page).toHaveURL("http://localhost:3000/")
    expect(
      (
        await context.request.get("http://localhost:3000/api/viewer/library")
      ).status()
    ).toBe(401)
    checks.push(
      "watchlist removal, empty state, ownership enforcement and logout"
    )
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Viewer flow failed")
    await page.screenshot({
      path: `${output}/viewer-failure.png`,
      fullPage: true,
    })
    throw error
  } finally {
    mkdirSync(output, { recursive: true })
    writeFileSync(
      `${output}/viewer-results.json`,
      JSON.stringify({ checks, errors }, null, 2)
    )
    await browser.close()
    try {
      await db.user.deleteMany({ where: { email } })
      if (contentId) await db.content.deleteMany({ where: { id: contentId } })
      if (creatorId) await db.person.deleteMany({ where: { id: creatorId } })
    } finally {
      await db.$disconnect()
    }
  }
  expect(errors).toEqual([])
  console.log(JSON.stringify({ checks, errors }))
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Viewer browser verification failed"
  )
  process.exitCode = 1
})
