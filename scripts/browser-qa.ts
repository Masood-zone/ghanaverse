import "dotenv/config"
import { chromium, expect as baseExpect } from "@playwright/test"
import sharp from "sharp"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { v2 as cloudinary } from "cloudinary"

const output = "artifacts/implementation-qa"
const expect = baseExpect.configure({ timeout: 60000 })
mkdirSync(output, { recursive: true })
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})
const ids: {
  creator?: string
  content?: string
  collection?: string
  asset?: string
  publicId?: string
} = {}
const title = `QA Catalogue ${Date.now()}`
const result: { checks: string[]; errors: string[] } = {
  checks: [],
  errors: [],
}
async function main() {
  const cachedChromium = chromium.executablePath()
  const browser = await chromium.launch({
    ...(existsSync(cachedChromium)
      ? { executablePath: cachedChromium }
      : { channel: "msedge" }),
    headless: true,
    args: ["--no-proxy-server"],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(45000)
  page.on("dialog", (dialog) => dialog.accept())
  page.on("pageerror", (error) => result.errors.push(error.message))
  const started = Date.now()
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith("/api/"))
      console.log(
        `${Date.now() - started}ms request ${request.method()} ${path}`
      )
  })
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname
    if (path.startsWith("/api/"))
      console.log(
        `${Date.now() - started}ms response ${response.status()} ${path}`
      )
  })
  async function shot(name: string) {
    await page.evaluate(async () => {
      await document.fonts.ready
      window.scrollTo(0, 0)
    })
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true })
  }
  try {
    await page.goto("http://localhost:3000/auth?callbackUrl=%2Fadmin")
    await page
      .getByLabel("Email address", { exact: true })
      .fill(process.env.SEED_ADMIN_EMAIL!)
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.SEED_ADMIN_PASSWORD!)
    const signIn = page.waitForResponse(
      (r) =>
        r.url().includes("/api/auth/sign-in/email") &&
        r.request().method() === "POST",
      { timeout: 120000 }
    )
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    expect((await signIn).status()).toBe(200)
    await expect(
      page.getByRole("heading", { name: "Dashboard Overview" })
    ).toBeVisible()
    await expect(page.getByText("Total titles", { exact: true })).toBeVisible()
    await shot("A01-dashboard-1440")
    result.checks.push("administrator sign-in and dashboard")
    await page.goto("http://localhost:3000/admin/creators")
    await page.getByRole("button", { name: "Add Record" }).click()
    await page.getByLabel("Name", { exact: true }).fill(`${title} Creator`)
    const creatorResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/creators") &&
        r.request().method() === "POST"
    )
    await page.getByRole("button", { name: "Save record", exact: true }).click()
    const creator = await creatorResponse
    expect(creator.status()).toBe(200)
    ids.creator = (await creator.json()).data.id
    await expect(
      page.getByText(`${title} Creator`, { exact: true })
    ).toBeVisible()
    await page.goto("http://localhost:3000/admin/content/new")
    await page.getByLabel("Content title", { exact: true }).fill(title)
    await page
      .getByLabel("Short logline / synopsis", { exact: true })
      .fill("Temporary browser acceptance record")
    await page
      .getByLabel("Full description", { exact: true })
      .fill(
        "Created to verify the complete administrator workflow, then removed."
      )
    await page.getByRole("tab", { name: "Classification & Meta" }).click()
    await page
      .getByLabel("Audience classification", { exact: true })
      .selectOption({ label: "PG" })
    await page.getByLabel("Drama", { exact: true }).check()
    await page.getByLabel("English", { exact: true }).check()
    await page.getByRole("tab", { name: "People & Production" }).click()
    await page.getByRole("button", { name: "Add Contributor" }).click()
    await page.getByLabel("Person", { exact: true }).selectOption(ids.creator!)
    await page.getByRole("tab", { name: "General", exact: true }).click()
    await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
      title
    )
    result.checks.push("React Hook Form tab persistence and creator credit")
    const image = await sharp({
      create: {
        width: 320,
        height: 480,
        channels: 3,
        background: { r: 141, g: 75, b: 0 },
      },
    })
      .png()
      .toBuffer()
    const uploadResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/uploads") && r.request().method() === "POST"
    )
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name: "qa-poster.png",
      mimeType: "image/png",
      buffer: image,
    })
    const upload = await uploadResponse
    expect(upload.status(), "Live Cloudinary artwork upload").toBe(200)
    const asset = (await upload.json()).data
    ids.asset = asset.id
    ids.publicId = asset.publicId
    await expect(
      page.getByText("Remove image reference", { exact: true })
    ).toBeVisible()
    const saveResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/content") &&
        r.request().method() === "POST"
    )
    await page.getByRole("button", { name: "Save Draft", exact: true }).click()
    const saved = await saveResponse
    expect(saved.status()).toBe(200)
    ids.content = (await saved.json()).data.id
    await expect(
      page.getByRole("heading", { name: `Editing: ${title}` })
    ).toBeVisible()
    await shot("A03-editor-1440")
    result.checks.push("live Cloudinary upload and persisted content draft")
    await page.getByRole("link", { name: "Preview on GhanaVerse" }).click()
    await expect(
      page.getByText("Private administrator preview", { exact: true })
    ).toBeVisible()
    await shot("A03-preview-1440")
    await page.getByRole("link", { name: "Return to editor" }).click()
    await page.getByRole("button", { name: "Publish", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Unpublish to edit" })
    ).toBeVisible()
    const record = await db.content.findUniqueOrThrow({
      where: { id: ids.content },
    })
    const publicResponse = await context.request.get(
      `http://localhost:3000/api/content/${record.slug}`
    )
    expect(publicResponse.status()).toBe(200)
    const publicData = (await publicResponse.json()).data
    expect(publicData.credits[0].creditType).toBe("CREATOR")
    expect(publicData.attributionNotes).toBeUndefined()
    expect(publicData.sourcePayload).toBeUndefined()
    const blocked = await context.request.patch(
      `http://localhost:3000/api/admin/content/${ids.content}`,
      { data: { title: "Bypass attempt" } }
    )
    expect(blocked.status()).toBe(409)
    result.checks.push(
      "publication, public privacy and published-edit protection"
    )
    const collection = await context.request.post(
      "http://localhost:3000/api/admin/collections",
      {
        data: {
          name: title,
          slug: `qa-${Date.now()}`,
          isActive: true,
          sortOrder: 0,
          contentIds: [ids.content],
        },
      }
    )
    expect(collection.status()).toBe(200)
    ids.collection = (await collection.json()).data.id
    await page.goto("http://localhost:3000/admin/collections")
    await expect(
      page.getByRole("heading", { name: title, exact: true })
    ).toBeVisible()
    await shot("collections-1440")
    await page.goto(`http://localhost:3000/admin/content/${ids.content}`)
    await page.getByRole("button", { name: "Unpublish to edit" }).click()
    await expect(
      page.getByLabel("Content title", { exact: true })
    ).toBeEnabled()
    await page
      .getByLabel("Content title", { exact: true })
      .fill(`${title} Updated`)
    await page
      .getByRole("button", { name: "Save Changes", exact: true })
      .click()
    await expect(
      page.getByText("Unsaved changes", { exact: false })
    ).not.toBeVisible()
    await page.getByRole("button", { name: "Publish", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Unpublish to edit" })
    ).toBeVisible()
    result.checks.push("curation, unpublish, edit and republish")
    for (const [path, name] of [
      ["content", "A02-library"],
      ["metadata", "A04-metadata"],
      ["users", "A05-users"],
      ["activity", "activity"],
    ]) {
      await page.goto(`http://localhost:3000/admin/${path}`)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(page.getByLabel("Loading data")).not.toBeVisible()
      await shot(`${name}-1440`)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    for (const [path, name] of [
      ["content", "A02-library"],
      [`content/${ids.content}`, "A03-editor"],
      ["users", "A05-users"],
    ]) {
      await page.goto(`http://localhost:3000/admin/${path}`)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(page.getByLabel("Loading data")).not.toBeVisible()
      await shot(`${name}-390`)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      )
      expect(overflow, `${name} mobile overflow`).toBe(false)
    }
    result.checks.push("desktop/mobile screen capture and overflow checks")
    const anonymous = await browser.newContext()
    expect(
      (
        await anonymous.request.get("http://localhost:3000/api/admin/users")
      ).status()
    ).toBe(401)
    expect(
      (
        await anonymous.request.get(
          `http://localhost:3000/admin/content/${ids.content}/preview`
        )
      ).url()
    ).toContain("/auth")
    await anonymous.close()
    result.checks.push("anonymous API and draft-preview restrictions")
    await page.goto("http://localhost:3000/admin")
    await page.getByRole("button", { name: "Open navigation" }).click()
    await page.getByRole("button", { name: "Sign Out", exact: true }).click()
    await expect(page).toHaveURL("http://localhost:3000/")
    expect(
      (
        await context.request.get("http://localhost:3000/api/admin/users")
      ).status()
    ).toBe(401)
    result.checks.push("logout and protected session removal")
  } catch (error) {
    await shot("failure")
    throw error
  } finally {
    if (ids.collection)
      await db.collection.deleteMany({ where: { id: ids.collection } })
    if (ids.content) await db.content.deleteMany({ where: { id: ids.content } })
    if (ids.creator) await db.person.deleteMany({ where: { id: ids.creator } })
    if (ids.asset)
      await db.artworkAsset.deleteMany({ where: { id: ids.asset } })
    if (ids.publicId) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      })
      await cloudinary.uploader.destroy(ids.publicId, {
        resource_type: "image",
      })
    }
    const cleanupIds = Object.values(ids).filter((value): value is string =>
      Boolean(value)
    )
    if (cleanupIds.length)
      await db.auditLog.deleteMany({ where: { entityId: { in: cleanupIds } } })
    writeFileSync(
      `${output}/browser-results.json`,
      JSON.stringify(result, null, 2)
    )
    await browser.close()
    await db.$disconnect()
  }
  expect(result.errors).toEqual([])
  console.log(JSON.stringify(result))
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Browser verification failed"
  )
  process.exitCode = 1
})
