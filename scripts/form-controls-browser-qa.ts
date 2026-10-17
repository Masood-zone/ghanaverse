import "dotenv/config"
import { chromium, expect as baseExpect } from "@playwright/test"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"

const base = process.env.FORM_QA_URL ?? "http://localhost:3104"
const expect = baseExpect.configure({ timeout: 60000 })
const database = process.env.TEST_DATABASE_URL
if (
  !database ||
  new URL(database).searchParams.get("schema") !== "ghanaverse_test" ||
  !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)
)
  throw new Error(
    "Form QA requires a local server using the isolated test schema"
  )
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: database },
    { schema: "ghanaverse_test" }
  ),
})
const output = "artifacts/implementation-qa/form-controls"
mkdirSync(output, { recursive: true })
const suffix = randomUUID(),
  checks: string[] = [],
  errors: string[] = []
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
const page = await context.newPage()
page.setDefaultTimeout(60000)
page.on("pageerror", (error) => errors.push(error.message))
page.on("dialog", (dialog) => dialog.accept())
let userId: string | undefined,
  contentId: string | undefined,
  genreId: string | undefined,
  languageId: string | undefined,
  classificationId: string | undefined
async function choose(label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}
try {
  const registered = await context.request.post(
    `${base}/api/auth/sign-up/email`,
    {
      headers: { origin: base },
      data: {
        name: "Form Controls QA",
        email: `forms-${suffix}@example.test`,
        password: `FormsQA-${randomUUID()}!`,
      },
    }
  )
  expect(registered.status()).toBe(200)
  userId = (await registered.json()).user.id
  await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } })
  const genre = await db.genre.create({
    data: { name: `QA Genre ${suffix}`, slug: `qa-${suffix}` },
  })
  genreId = genre.id
  const language = await db.language.create({
    data: { name: `QA Language ${suffix}`, code: `qa-${suffix}` },
  })
  languageId = language.id
  const classification = await db.classification.create({
    data: { name: `QA Rating ${suffix}`, slug: `qa-${suffix}` },
  })
  classificationId = classification.id
  const content = await db.content.create({
    data: {
      title: `Form QA ${suffix}`,
      slug: `form-qa-${suffix}`,
      shortDescription: "Temporary form verification",
      description: "Temporary form verification",
      contentType: "MOVIE",
    },
  })
  contentId = content.id
  await page.goto(`${base}/admin/content/${content.id}`)
  await expect(page.getByLabel("Content title", { exact: true })).toHaveValue(
    content.title
  )
  await choose("Audience classification", classification.name)
  await page.getByRole("checkbox", { name: genre.name, exact: true }).check()
  await page.getByRole("checkbox", { name: language.name, exact: true }).check()
  await page.getByRole("tab", { name: "Publishing", exact: true }).click()
  await page
    .getByRole("switch", { name: "Feature in catalogue", exact: true })
    .check()
  const [saved] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/admin/content/${content.id}`) &&
        r.request().method() === "PATCH"
    ),
    page.getByRole("button", { name: "Save Changes", exact: true }).click(),
  ])
  expect(saved.status()).toBe(200)
  const persisted = await db.content.findUniqueOrThrow({
    where: { id: content.id },
    include: { genres: true, languages: true },
  })
  expect(persisted.classification).toBe(classification.name)
  expect(persisted.isFeatured).toBe(true)
  expect(persisted.genres.map((g) => g.genreId)).toEqual([genre.id])
  expect(persisted.languages.map((l) => l.languageId)).toEqual([language.id])
  await page.reload()
  await expect(
    page.getByRole("switch", { name: "Feature in catalogue", exact: true })
  ).toBeChecked()
  checks.push(
    "Select, switch and checkbox-array values persist through the admin API and reload"
  )
  console.log(checks.at(-1))

  await page.getByRole("tab", { name: "Video & Trailer", exact: true }).click()
  const source = page.getByRole("combobox", {
    name: "Source type",
    exact: true,
  })
  await expect(source).toHaveText("Direct video URL")
  await source.focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(source).toHaveText("YouTube")
  await page
    .getByRole("switch", { name: "Enable playback", exact: true })
    .check()
  await page
    .getByRole("switch", { name: "Enable playback", exact: true })
    .uncheck()
  await page
    .getByLabel("YouTube or direct-video URL")
    .fill("https://www.youtube.com/watch?v=M7lc1UVf-VE")
  const [mediaSaved] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/admin/content/${content.id}/video-assets`) &&
        r.request().method() === "POST"
    ),
    page
      .getByRole("button", { name: "Add playback asset", exact: true })
      .click(),
  ])
  expect(mediaSaved.status()).toBe(200)
  await expect(source).toHaveText("Direct video URL")
  await expect(page.getByLabel("YouTube or direct-video URL")).toHaveValue("")
  await expect(
    page.getByRole("switch", { name: "Enable playback", exact: true })
  ).not.toBeChecked()
  checks.push(
    "Keyboard selection, boolean toggles and post-save form reset work in the media form"
  )
  console.log(checks.at(-1))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await source.click()
    await expect(
      page.getByRole("option", { name: "YouTube", exact: true })
    ).toBeVisible()
    await page.screenshot({
      path: `${output}/media-${width}.png`,
      fullPage: true,
    })
    await page.keyboard.press("Escape")
    const overflow = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main *, body > *"))
        .flatMap((el) => {
          const box = el.getBoundingClientRect()
          return box.right > innerWidth + 1 &&
            getComputedStyle(el).position !== "fixed"
            ? [
                {
                  tag: el.tagName,
                  class: el.className,
                  right: box.right,
                  width: box.width,
                },
              ]
            : []
        })
        .slice(0, 15)
    )
    if (
      overflow.length &&
      (await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1
      ))
    )
      console.log("Overflow diagnostic", JSON.stringify(overflow))
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true)
  }
  checks.push("Desktop and mobile dropdowns render without horizontal overflow")

  await db.content.update({
    where: { id: content.id },
    data: { publicationStatus: "PUBLISHED" },
  })
  await page.reload()
  await expect(
    page.getByRole("switch", { name: "Enable playback", exact: true })
  ).toBeDisabled()
  await expect(source).toBeDisabled()
  checks.push(
    "Published content preserves fieldset disabling for custom switches and dropdowns"
  )

  await page.goto(`${base}/profiles`)
  await page.getByRole("button", { name: "Add Profile", exact: false }).click()
  const dialog = page.getByRole("dialog")
  await dialog
    .getByLabel("Profile name", { exact: true })
    .fill("Form QA Profile")
  for (const name of [
    "Kids mode",
    "Autoplay next episode",
    "Prefer subtitles when available",
  ]) {
    await dialog.getByRole("switch", { name, exact: true }).check()
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await dialog.screenshot({ path: `${output}/preferences-${width}.png` })
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    ).toBe(true)
  }
  const [profileSaved] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/profiles") && r.request().method() === "POST"
    ),
    page.waitForEvent("load"),
    dialog.getByRole("button", { name: "Save Profile", exact: true }).click(),
  ])
  expect(profileSaved.status()).toBe(200)
  const profile = await db.viewerProfile.findFirstOrThrow({
    where: { userId, name: "Form QA Profile" },
  })
  expect(
    profile.isKids && profile.autoplayNextEpisode && profile.preferSubtitles
  ).toBe(true)
  checks.push(
    "Reference-style profile switches work inside a modal and persist all three preferences; desktop/mobile screenshots captured"
  )

  // Publish only the disposable test record to exercise the public GET filter.
  await db.content.update({
    where: { id: content.id },
    data: { publicationStatus: "PUBLISHED" },
  })
  await page.goto(`${base}/browse`)
  await choose("All genres", genre.name)
  await page.getByRole("button", { name: "Apply filters", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`genre=${genre.slug}`))
  await expect(
    page.getByRole("combobox", { name: "All genres", exact: true })
  ).toHaveText(genre.name)
  checks.push(
    "Server-rendered catalogue dropdowns retain their GET form submission and selected labels"
  )
  expect(errors).toEqual([])
  console.log(JSON.stringify({ checks, browserErrors: errors }, null, 2))
} finally {
  await page
    .screenshot({ path: `${output}/last-state.png`, fullPage: true })
    .catch(() => {})
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ checks, browserErrors: errors }, null, 2)
  )
  await browser.close()
  if (contentId) await db.content.delete({ where: { id: contentId } })
  if (genreId) await db.genre.delete({ where: { id: genreId } })
  if (languageId) await db.language.delete({ where: { id: languageId } })
  if (classificationId)
    await db.classification.delete({ where: { id: classificationId } })
  if (userId) await db.user.delete({ where: { id: userId } })
  await db.$disconnect()
}
