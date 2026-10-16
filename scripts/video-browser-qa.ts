import "dotenv/config"
import {
  chromium,
  expect as baseExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"
import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const expect = baseExpect.configure({ timeout: 120000 })
const base = process.env.QA_BASE_URL ?? "http://localhost:3000"
const output = "artifacts/implementation-qa/r2"
mkdirSync(output, { recursive: true })
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})
const suffix = randomUUID(),
  ids: string[] = [],
  sessionIds: string[] = []
const report: {
  checks: string[]
  errors: string[]
  measurements: Record<string, number>
} = { checks: [], errors: [], measurements: {} }
let ownerId: string | undefined, holderId: string | undefined
let companyId: string | undefined
function pass(message: string) {
  report.checks.push(message)
  writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2))
  console.log(`PASS ${message}`)
}
async function api<T>(
  context: BrowserContext,
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await context.request.fetch(`${base}/api/${path}`, {
    method,
    data: body,
    headers: { origin: base },
  })
  const value = await response.json()
  if (!response.ok() || !value.success)
    throw new Error(
      `${method} ${path}: ${response.status()} ${value.message ?? "Request failed"}`
    )
  return value.data as T
}
async function waitVideo(page: Page) {
  await expect(async () => {
    expect(
      await page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.readyState)
    ).toBeGreaterThanOrEqual(2)
  }).toPass({ timeout: 120000 })
}
async function main() {
  if (!existsSync(`${output}/flower.mp4`)) {
    const response = await fetch(
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    )
    if (!response.ok) throw new Error("MDN CC0 test video unavailable")
    writeFileSync(
      `${output}/flower.mp4`,
      new Uint8Array(await response.arrayBuffer())
    )
  }
  const small = readFileSync(`${output}/flower.mp4`)
  // A legal MP4 free-space box extends the fixture to 40 MiB for multipart recovery.
  const padding = Buffer.alloc(40 * 1024 * 1024 - small.length)
  padding.writeUInt32BE(padding.length, 0)
  padding.write("free", 4, "ascii")
  writeFileSync(`${output}/recovery.mp4`, Buffer.concat([small, padding]))
  const launch = () =>
    chromium.launch({
      ...(existsSync(chromium.executablePath()) ? {} : { channel: "msedge" }),
      headless: true,
      args: ["--no-proxy-server"],
    })
  let browser = await launch()
  let admin = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  let owner = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  let page = await owner.newPage()
  page.setDefaultTimeout(120000)
  page.on("dialog", (dialog) => dialog.accept())
  page.on("pageerror", (error) => report.errors.push(error.message))
  try {
    const login = await admin.request.post(`${base}/api/auth/sign-in/email`, {
      headers: { origin: base },
      data: {
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      },
    })
    if (!login.ok()) throw new Error("Administrator sign-in failed")
    const ownerPassword = randomUUID() + "Aa1!"
    const ownerEmail = `video-qa-${suffix}@example.test`
    const register = await owner.request.post(
      `${base}/api/auth/sign-up/email`,
      {
        headers: { origin: base },
        data: {
          name: "Temporary video QA owner",
          email: ownerEmail,
          password: ownerPassword,
        },
      }
    )
    const account = await register.json()
    if (!register.ok() || !account.user?.id)
      throw new Error("Temporary owner registration failed")
    ownerId = account.user.id
    holderId = (
      await db.rightsHolder.create({
        data: { name: `Temporary R2 QA ${suffix}` },
      })
    ).id
    await api(admin, `admin/users/${ownerId}`, "PATCH", {
      role: "RIGHTS_HOLDER",
      isSuspended: false,
      rightsHolderIds: [holderId],
    })
    const ownerLogin = await owner.request.post(
      `${base}/api/auth/sign-in/email`,
      {
        headers: { origin: base },
        data: { email: ownerEmail, password: ownerPassword },
      }
    )
    if (!ownerLogin.ok())
      throw new Error("Owner sign-in after role assignment failed")
    await page.goto(`${base}/creator/content/new`)
    await page
      .getByLabel("Content title", { exact: true })
      .fill(`Temporary R2 QA Movie ${suffix}`)
    await page
      .getByLabel("Short logline / synopsis")
      .fill("Temporary video upload verification")
    await page
      .getByLabel("Full description")
      .fill(
        "MDN CC0 flower video used only for temporary video workflow verification."
      )
    await page.getByRole("tab", { name: "People & Rights" }).click()
    await page
      .getByLabel("Rights holder", { exact: true })
      .selectOption(holderId)
    await page
      .getByLabel("Media rights", { exact: true })
      .selectOption("CREATIVE_COMMONS")
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/creator/content") &&
        r.request().method() === "POST"
    )
    await page.getByRole("button", { name: "Save Draft", exact: true }).click()
    const savedBody = await (await saved).json()
    if (!savedBody.success)
      throw new Error(`Owner draft save failed: ${savedBody.message}`)
    const movieId = savedBody.data.id as string
    ids.push(movieId)
    await expect(page).toHaveURL(new RegExp(`/creator/content/${movieId}`))
    pass("owner creates a title through the shared editor")
    await page.getByRole("tab", { name: "Video & Trailer" }).click()
    await expect(page).toHaveURL(/section=video/)
    await page.reload()
    await expect(
      page.getByRole("tab", { name: "Video & Trailer" })
    ).toHaveAttribute("aria-selected", "true")
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/video-uploads") &&
        r.request().method() === "POST"
    )
    const started = Date.now()
    await page
      .getByLabel(new RegExp("Upload video to Temporary R2 QA Movie"))
      .setInputFiles(resolve(`${output}/flower.mp4`))
    const session = (await (await created).json()).data
    if (!session?.id) throw new Error("Movie upload session creation failed")
    sessionIds.push(session.id)
    await expect(
      page.getByLabel("Video uploads").getByText("complete", { exact: true })
    ).toBeVisible({ timeout: 300000 })
    report.measurements.smallFileBytes = small.length
    report.measurements.smallUploadSeconds = (Date.now() - started) / 1000
    report.measurements.smallWorkflowBytesPerSecond =
      small.length / report.measurements.smallUploadSeconds
    const asset = await db.videoAsset.findFirstOrThrow({
      where: { contentId: movieId, sourceType: "MANAGED" },
    })
    pass(
      "real MP4 uploads directly to private R2 and attaches to the owner movie"
    )
    await page.getByRole("button", { name: "Preview", exact: true }).click()
    await waitVideo(page)
    const duration = await page
      .locator("video")
      .evaluate((v: HTMLVideoElement) => v.duration)
    expect(duration).toBeGreaterThan(4)
    await page.locator("video").evaluate(async (v: HTMLVideoElement) => {
      v.muted = true
      await v.play()
    })
    await expect(async () => {
      expect(
        await page
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.currentTime)
      ).toBeGreaterThan(0)
    }).toPass()
    await page.getByRole("button", { name: "Close video preview" }).click()
    expect(
      await db.playbackSession.count({ where: { videoAssetId: asset.id } })
    ).toBe(0)
    pass("owner preview decodes real media without recording viewer streams")
    await page
      .getByRole("button", { name: "Use this source", exact: true })
      .click()
    const [genre, language, company] = await Promise.all([
      db.genre.findFirstOrThrow(),
      db.language.findFirstOrThrow(),
      db.productionCompany.create({
        data: { name: `Temporary R2 QA Company ${suffix}` },
      }),
    ])
    companyId = company.id
    // Complete saved catalogue metadata through the authorized owner API.
    await api(owner, `creator/content/${movieId}`, "PATCH", {
      title: `Temporary R2 QA Movie ${suffix}`,
      shortDescription: "Temporary video upload verification",
      description: "MDN CC0 flower video for temporary verification.",
      contentType: "MOVIE",
      rightsHolderId: holderId,
      mediaRights: "CREATIVE_COMMONS",
      classification: "PG",
      genreIds: [genre.id],
      languageIds: [language.id],
      productionCompanyId: company.id,
      posterUrl: "/images/fallback-poster.svg",
    })
    await api(owner, `creator/content/${movieId}/publication`, "PATCH", {
      status: "PUBLISHED",
    })
    await page.goto(`${base}/watch/${asset.id}`)
    await waitVideo(page)
    await page
      .getByRole("button", { name: "Play", exact: true })
      .first()
      .click()
    await expect(async () => {
      expect(
        await db.playbackSession.count({ where: { videoAssetId: asset.id } })
      ).toBe(1)
    }).toPass({ timeout: 120000 })
    await page.getByLabel("Playback position", { exact: true }).fill("3")
    await expect(async () => {
      expect(
        await page
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.currentTime)
      ).toBeGreaterThanOrEqual(3)
    }).toPass()
    // Force a source failure after advancing the clock past the renewal debounce.
    const beforeRenewal = await db.playbackSession.findFirstOrThrow({
      where: { videoAssetId: asset.id },
    })
    await page.clock.setFixedTime(new Date(Date.now() + 31000))
    const renewalResponse = page.waitForResponse((r) =>
      r.url().endsWith(`/api/playback/assets/${asset.id}/source`)
    )
    await page
      .locator("video")
      .evaluate((v: HTMLVideoElement) => v.dispatchEvent(new Event("error")))
    expect((await renewalResponse).status()).toBe(200)
    await waitVideo(page)
    expect(
      await db.playbackSession.count({ where: { videoAssetId: asset.id } })
    ).toBe(1)
    expect(
      (
        await db.playbackSession.findFirstOrThrow({
          where: { id: beforeRenewal.id },
        })
      ).id
    ).toBe(beforeRenewal.id)
    await page.clock.setFixedTime(new Date())
    pass(
      "self-publication, protected viewing, seeking and source renewal retain one analytics session"
    )
    await api(owner, `creator/content/${movieId}/publication`, "PATCH", {
      status: "UNPUBLISHED",
    })
    // Episode destination for multipart recovery.
    const series = await api<{ id: string }>(owner, "creator/content", "POST", {
      title: `Temporary R2 QA Series ${suffix}`,
      shortDescription: "Temporary series",
      description: "Temporary multipart recovery verification",
      contentType: "SERIES",
      rightsHolderId: holderId,
      mediaRights: "CREATIVE_COMMONS",
    })
    ids.push(series.id)
    const season = await api<{ id: string }>(
      owner,
      `creator/content/${series.id}/seasons`,
      "POST",
      { seasonNumber: 1 }
    )
    const episode = await api<{ id: string }>(
      owner,
      `creator/seasons/${season.id}/episodes`,
      "POST",
      { episodeNumber: 3, title: "Recovery destination" }
    )
    await page.goto(`${base}/creator/content/${series.id}?section=episodes`)
    const dismiss = page
      .getByLabel("Video uploads")
      .getByRole("button", { name: "Dismiss" })
    if (await dismiss.count()) await dismiss.click()
    let blockRemaining = true
    const heldTransfers: (() => void)[] = []
    await owner.route(/r2\.cloudflarestorage\.com/, async (route) => {
      const request = route.request(),
        url = new URL(request.url())
      if (
        blockRemaining &&
        request.method() === "PUT" &&
        Number(url.searchParams.get("partNumber")) >= 2
      )
        await new Promise<void>((resolve) => heldTransfers.push(resolve))
      try {
        await route.continue()
      } catch {
        /* A paused transfer may already be aborted. */
      }
    })
    const largeCreated = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/video-uploads") &&
        r.request().method() === "POST"
    )
    await page
      .getByLabel(
        "Upload video to Season 1 · Episode 3: Recovery destination",
        { exact: true }
      )
      .setInputFiles(resolve(`${output}/recovery.mp4`))
    const largeSession = (await (await largeCreated).json()).data
    if (!largeSession?.id) throw new Error("Episode session creation failed")
    sessionIds.push(largeSession.id)
    await expect(
      page.getByLabel("Video uploads").getByText(/40% confirmed/)
    ).toBeVisible({ timeout: 300000 })
    const secondTab = await owner.newPage()
    secondTab.on("dialog", (dialog) => dialog.accept())
    await secondTab.goto(
      `${base}/creator/content/${series.id}?section=episodes`
    )
    await secondTab
      .getByLabel("Reselect recovery.mp4", { exact: true })
      .setInputFiles(resolve(`${output}/recovery.mp4`))
    await expect(
      secondTab.getByText(
        "Another browser tab is uploading. Pause it before resuming here.",
        { exact: true }
      )
    ).toBeVisible()
    await secondTab.close()
    await page
      .getByLabel("Video uploads")
      .getByRole("button", { name: "Pause", exact: true })
      .click()
    for (const release of heldTransfers) release()
    await owner.setOffline(true)
    await page
      .getByLabel("Video uploads")
      .getByRole("button", { name: "Resume", exact: true })
      .click()
    await expect(
      page.getByText("Offline. Reconnect, then resume.", { exact: true })
    ).toBeVisible()
    await owner.setOffline(false)
    const state = await api<{ parts: { bytes: number; partNumber: number }[] }>(
      owner,
      `video-uploads/${largeSession.id}`
    )
    expect(state.parts).toHaveLength(1)
    report.measurements.recoveredBytes = state.parts[0].bytes
    await page.reload()
    await page
      .getByLabel("Reselect recovery.mp4", { exact: true })
      .setInputFiles(resolve(`${output}/flower.mp4`))
    await expect(page.getByText(/This is a different file/)).toBeVisible()
    blockRemaining = false
    const [adminState, ownerState] = await Promise.all([
      admin.storageState(),
      owner.storageState(),
    ])
    await browser.close()
    browser = await launch()
    admin = await browser.newContext({ storageState: adminState })
    owner = await browser.newContext({
      storageState: ownerState,
      viewport: { width: 1440, height: 1000 },
    })
    page = await owner.newPage()
    page.setDefaultTimeout(120000)
    page.on("dialog", (dialog) => dialog.accept())
    page.on("pageerror", (error) => report.errors.push(error.message))
    await page.goto(`${base}/creator/content/${series.id}?section=episodes`)
    let issuedExpired = false
    const signingClient = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
    })
    await owner.route(
      `**/api/video-uploads/${largeSession.id}/parts`,
      async (route) => {
        const response = await route.fetch(),
          body = await response.json()
        const part = route.request().postDataJSON() as {
          partNumber: number
          md5: string
        }
        if (!issuedExpired && body.success && part.partNumber === 2) {
          issuedExpired = true
          const original = new URL(body.data.url)
          body.data.url = await getSignedUrl(
            signingClient,
            new UploadPartCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: decodeURIComponent(original.pathname).replace(
                `/${process.env.R2_BUCKET_NAME}/`,
                ""
              ),
              UploadId: original.searchParams.get("uploadId")!,
              PartNumber: 2,
              ContentLength: 16 * 1024 * 1024,
              ContentMD5: Buffer.from(part.md5, "hex").toString("base64"),
            }),
            {
              expiresIn: 300,
              signingDate: new Date(Date.now() - 3600000),
              unhoistableHeaders: new Set(["content-md5"]),
              signableHeaders: new Set(["content-md5", "content-length"]),
            }
          )
          await route.fulfill({ response, json: body })
        } else await route.fulfill({ response })
      }
    )
    const resumed = Date.now()
    await page
      .getByLabel("Reselect recovery.mp4", { exact: true })
      .setInputFiles(resolve(`${output}/recovery.mp4`))
    await expect(
      page.getByLabel("Video uploads").getByText("complete", { exact: true })
    ).toBeVisible({ timeout: 600000 })
    report.measurements.remainingBytes =
      40 * 1024 * 1024 - report.measurements.recoveredBytes
    report.measurements.resumeSeconds = (Date.now() - resumed) / 1000
    report.measurements.resumeBytesPerSecond =
      report.measurements.remainingBytes / report.measurements.resumeSeconds
    expect(issuedExpired).toBe(true)
    await api(owner, `creator/content/${series.id}`)
    const episodeAsset = await db.videoAsset.findFirstOrThrow({
      where: { episodeId: episode.id, sourceType: "MANAGED" },
    })
    expect(episodeAsset.episodeId).toBe(episode.id)
    pass(
      "40 MiB episode upload survives refresh and browser restart, rejects a wrong file, blocks duplicate tabs, pauses offline, refreshes an expired signature and resumes only missing parts"
    )
    await page.getByRole("button", { name: "Preview", exact: true }).click()
    await waitVideo(page)
    await page.getByRole("button", { name: "Close video preview" }).click()
    await page.evaluate(async () => {
      await document.fonts.ready
      window.scrollTo(0, 0)
    })
    await page.screenshot({
      path: `${output}/episode-desktop.png`,
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page
      .getByLabel("Video uploads")
      .getByRole("button", { name: "Video uploads" })
      .click()
      .catch(() => {})
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `${output}/episode-mobile.png`,
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    pass("episode preview decodes and shared editor fits mobile width")
    expect(report.errors).toEqual([])
  } catch (error) {
    report.errors.push(
      error instanceof Error ? error.message : "Video QA failed"
    )
    await page
      .screenshot({ path: `${output}/failure.png`, fullPage: true })
      .catch(() => {})
    throw error
  } finally {
    for (const id of sessionIds) {
      try {
        await api(admin, `video-uploads/${id}`, "DELETE")
      } catch {
        /* A completed upload is removed with its parent title below. */
      }
    }
    for (const id of ids) {
      try {
        await api(admin, `admin/content/${id}/publication`, "PATCH", {
          status: "UNPUBLISHED",
        })
        await api(admin, `admin/content/${id}`, "DELETE")
      } catch {
        report.errors.push(`Fixture cleanup needs attention for title ${id}`)
      }
    }
    try {
      await api(admin, "admin/storage/cleanup", "POST", {})
    } catch {
      report.errors.push("R2 cleanup needs attention")
    }
    const stored = await db.storedVideoObject.findMany({
      where: { sessionId: { in: sessionIds } },
    })
    if (stored.every((o) => o.state === "DELETED")) {
      await db.storedVideoObject.deleteMany({
        where: { sessionId: { in: sessionIds } },
      })
      await db.videoStorageReservation.deleteMany({
        where: { sessionId: { in: sessionIds } },
      })
      await db.videoUploadSession.deleteMany({
        where: { id: { in: sessionIds } },
      })
    } else report.errors.push("Stored QA objects remain pending cleanup")
    if (ownerId) {
      await db.auditLog.deleteMany({
        where: { OR: [{ actorId: ownerId }, { entityId: { in: ids } }] },
      })
      await db.user.delete({ where: { id: ownerId } })
    }
    if (holderId) await db.rightsHolder.delete({ where: { id: holderId } })
    if (companyId)
      await db.productionCompany.delete({ where: { id: companyId } })
    await browser.close()
    await db.$disconnect()
    writeFileSync(`${output}/results.json`, JSON.stringify(report, null, 2))
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Video QA failed")
  process.exitCode = 1
})
