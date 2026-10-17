import "dotenv/config"
import { chromium, expect as baseExpect, type Page } from "@playwright/test"
import { hashPassword } from "better-auth/crypto"
import { randomBytes } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { getPrisma } from "../lib/prisma"
const expect = baseExpect.configure({ timeout: 60000 }),
  db = getPrisma(),
  suffix = Date.now()
const password = randomBytes(18).toString("base64url"),
  adminId = `qa-rights-admin-${suffix}`
const adminEmail = `${adminId}@example.test`,
  ownerEmail = `qa-owner-${suffix}@example.test`,
  business = `QA Rights ${suffix}`
const base = "http://localhost:3000",
  output = "artifacts/implementation-qa",
  checks: string[] = [],
  errors: string[] = []
mkdirSync(output, { recursive: true })
const titles: string[] = [],
  users = [adminId]
let holderId: string | undefined
function pass(message: string) {
  checks.push(message)
  console.log("Verified: " + message)
}
async function signIn(page: Page, email: string, callback: string) {
  await page.goto(`${base}/auth?callbackUrl=${encodeURIComponent(callback)}`)
  await page.getByLabel("Email address", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await page.waitForURL(`${base}${callback}`)
}
async function main() {
  await db.user.create({
    data: {
      id: adminId,
      name: "QA Rights Administrator",
      email: adminEmail,
      role: "ADMIN",
      profiles: { create: { name: "QA Profile" } },
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: adminId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  })
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-proxy-server"],
  })
  const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await adminContext.newPage()
  page.setDefaultTimeout(60000)
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("dialog", (dialog) => dialog.accept())
  try {
    await signIn(page, adminEmail, "/admin/users")
    await page
      .getByRole("button", { name: "Create rights holder", exact: true })
      .click()
    await page
      .getByLabel("Contact name", { exact: true })
      .fill("QA Owner Contact")
    await page.getByLabel("Login email", { exact: true }).fill(ownerEmail)
    await page.getByLabel("Initial password", { exact: true }).fill(password)
    await page.getByLabel("Confirm password", { exact: true }).fill(password)
    await page
      .getByLabel("Rights-holder / business name", { exact: true })
      .fill(business)
    await page
      .getByLabel("Phone (optional)", { exact: true })
      .fill("+233 20 000 0000")
    const creation = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/admin/users") &&
        response.request().method() === "POST"
    )
    await page
      .locator("form")
      .filter({
        has: page.getByRole("heading", {
          name: "Create rights-holder account",
        }),
      })
      .getByRole("button", { name: "Create rights holder", exact: true })
      .click()
    expect((await creation).status()).toBe(200)
    const owner = await db.user.findUniqueOrThrow({
      where: { email: ownerEmail },
      include: { rightsHolderMemberships: true },
    })
    users.push(owner.id)
    holderId = owner.rightsHolderMemberships[0].rightsHolderId
    await page.getByRole("combobox", { name: "Filter role" }).click()
    await page
      .getByRole("option", { name: "RIGHTS_HOLDER", exact: true })
      .click()
    await expect(
      page.getByRole("cell", { name: ownerEmail, exact: true })
    ).toBeVisible()
    await page.screenshot({
      path: `${output}/rights-users-desktop.png`,
      fullPage: true,
    })
    pass(
      "administrator creates a rights-holder account with credentials and business details through the UI"
    )
    const title = await db.content.create({
      data: {
        title: `QA YouTube ${suffix}`,
        slug: `qa-youtube-${suffix}`,
        shortDescription: "Temporary browser QA",
        description: "Temporary browser QA",
        contentType: "MOVIE",
        rightsHolderId: holderId,
      },
      select: { id: true },
    })
    titles.push(title.id)
    await page.goto(`${base}/admin/content/${title.id}`)
    await page.getByRole("tab", { name: "Rights", exact: true }).click()
    await expect(
      page.getByRole("combobox", { name: "Rights holder", exact: true })
    ).toContainText("QA Owner Contact")
    await page
      .getByLabel("YouTube or direct-video URL")
      .fill("https://www.youtube.com/watch?v=M7lc1UVf-VE")
    await page.getByRole("combobox", { name: "Rights", exact: true }).click()
    await page.getByRole("option", { name: "LICENSED", exact: true }).click()
    await page.getByLabel("Duration in minutes").fill("37.5")
    await page
      .getByRole("switch", { name: "Enable playback", exact: true })
      .check()
    const media = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/content/${title.id}/video-assets`) &&
        response.request().method() === "POST"
    )
    await page
      .getByRole("button", { name: "Add playback asset", exact: true })
      .click()
    expect((await media).status()).toBe(200)
    const asset = await db.videoAsset.findFirstOrThrow({
      where: { contentId: title.id },
    })
    expect(asset.sourceType).toBe("YOUTUBE")
    expect(asset.durationSeconds).toBe(2250)
    await db.content.update({
      where: { id: title.id },
      data: { publicationStatus: "PUBLISHED" },
    })
    pass(
      "content owner selector, automatic YouTube detection, and 37.5 minutes stored as 2250 seconds"
    )
    const ownerContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      ownerPage = await ownerContext.newPage()
    ownerPage.on("pageerror", (error) => errors.push(error.message))
    ownerPage.setDefaultTimeout(60000)
    await ownerPage.route("https://www.youtube.com/iframe_api", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.YT={Player:class{constructor(element,options){this.o=options;this.state=2;this.position=Number(options.playerVars.start)||0;this.at=performance.now();this.root=document.createElement('div');this.root.style.padding='30px';element.replaceWith(this.root);for(const pair of [['Test Play',1],['Test Pause',2]]){const button=document.createElement('button');button.textContent=pair[0];button.style.margin='20px';button.onclick=()=>{this.position=this.getCurrentTime();this.at=performance.now();this.state=pair[1];options.events.onStateChange({data:this.state})};this.root.append(button)}queueMicrotask(()=>options.events.onReady())}getCurrentTime(){return this.position+(this.state===1?(performance.now()-this.at)/1000:0)}getDuration(){return 100}getPlayerState(){return this.state}getPlaybackRate(){return 1}destroy(){this.root.remove()}}};window.onYouTubeIframeAPIReady();`,
      })
    )
    await signIn(ownerPage, ownerEmail, `/watch/${asset.id}`)
    expect(
      await db.playbackSession.count({ where: { videoAssetId: asset.id } })
    ).toBe(0)
    const started = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/playback/sessions") &&
        response.request().method() === "POST"
    )
    await ownerPage
      .getByRole("button", { name: "Test Play", exact: true })
      .click()
    expect((await started).status()).toBe(200)
    expect(
      await db.playbackSession.count({ where: { videoAssetId: asset.id } })
    ).toBe(1)
    expect(
      await db.playbackSample.count({
        where: { session: { videoAssetId: asset.id } },
      })
    ).toBe(0)
    await ownerPage.waitForTimeout(1800)
    const saved = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/progress") &&
        response.request().method() === "PUT"
    )
    await ownerPage
      .getByRole("button", { name: "Test Pause", exact: true })
      .click()
    expect((await saved).status()).toBe(200)
    await ownerPage
      .getByRole("button", { name: "Test Play", exact: true })
      .click()
    await ownerPage
      .getByRole("button", { name: "Test Pause", exact: true })
      .click()
    expect(
      await db.playbackSession.count({ where: { videoAssetId: asset.id } })
    ).toBe(1)
    await ownerPage.reload()
    const reopened = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/playback/sessions") &&
        response.request().method() === "POST"
    )
    await ownerPage
      .getByRole("button", { name: "Test Play", exact: true })
      .click()
    expect((await reopened).status()).toBe(200)
    expect(
      await db.playbackSession.count({ where: { videoAssetId: asset.id } })
    ).toBe(2)
    await ownerPage
      .getByRole("button", { name: "Test Pause", exact: true })
      .click()
    pass(
      "simulated YouTube player: immediate stream before heartbeat, pause/resume deduplication, persisted viewing time, and reopening counts another stream"
    )
    expect(
      (await ownerContext.request.get(`${base}/api/admin/analytics`)).status()
    ).toBe(403)
    const report = await ownerContext.request.get(
      `${base}/api/creator/analytics?range=all&contentId=${title.id}`
    )
    expect(report.status()).toBe(200)
    expect((await report.json()).data.summary.streams).toBe(2)
    await ownerPage.goto(`${base}/creator/analytics`)
    await expect(
      ownerPage.getByRole("heading", {
        name: "Rights-holder reports",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      ownerPage.getByRole("cell", { name: `QA YouTube ${suffix}`, exact: true })
    ).toBeVisible()
    const download = ownerPage.waitForEvent("download")
    await ownerPage.getByRole("link", { name: "Export CSV report" }).click()
    expect((await download).suggestedFilename()).toBe(
      "ghanaverse-viewing-report.csv"
    )
    await ownerPage.screenshot({
      path: `${output}/rights-analytics-desktop.png`,
      fullPage: true,
    })
    await ownerPage.setViewportSize({ width: 390, height: 844 })
    await ownerPage.screenshot({
      path: `${output}/rights-analytics-mobile.png`,
      fullPage: true,
    })
    expect(
      await ownerPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    pass(
      "rights-holder reporting, scoped CSV download, denied administrator API access, and responsive report layout"
    )
    await page.goto(`${base}/admin/analytics`)
    await expect(
      page.getByRole("heading", { name: "Platform Analytics" })
    ).toBeVisible()
    await expect(
      page.getByRole("cell", { name: `QA YouTube ${suffix}`, exact: true })
    ).toBeVisible()
    await page.screenshot({
      path: `${output}/admin-analytics-desktop.png`,
      fullPage: true,
    })
    const guest = await browser.newContext()
    const guestPage = await guest.newPage()
    await guestPage.goto(`${base}/watch/${asset.id}`)
    await expect(guestPage).toHaveURL(/\/auth\?callbackUrl=/)
    await guest.close()
    pass("administrator report and signed-out watch-page redirection")
    const bytes = await ownerPage.evaluate(async () => {
      const canvas = document.createElement("canvas")
      canvas.width = 320
      canvas.height = 180
      const drawing = canvas.getContext("2d")!
      drawing.fillStyle = "#9b4d00"
      drawing.fillRect(0, 0, 320, 180)
      const stream = canvas.captureStream(10),
        recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp8",
        }),
        chunks: Blob[] = []
      recorder.ondataavailable = (event) => chunks.push(event.data)
      const result = new Promise<number[]>((resolve) => {
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop())
          resolve(
            Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))
          )
        }
      })
      const timer = window.setInterval(() => {
        drawing.fillStyle = "#9b4d00"
        drawing.fillRect(0, 0, 320, 180)
      }, 100)
      recorder.start()
      window.setTimeout(() => {
        window.clearInterval(timer)
        recorder.stop()
      }, 1800)
      return result
    })
    await ownerPage.route("https://media.example.test/qa.webm", (route) =>
      route.fulfill({ contentType: "video/webm", body: Buffer.from(bytes) })
    )
    const native = await db.content.create({
      data: {
        title: `QA Native ${suffix}`,
        slug: `qa-native-${suffix}`,
        shortDescription: "Temporary native QA",
        description: "Temporary native QA",
        contentType: "MOVIE",
        publicationStatus: "PUBLISHED",
        rightsHolderId: holderId,
        videoAssets: {
          create: {
            sourceType: "REMOTE_URL",
            playbackUrl: "https://media.example.test/qa.webm",
            licenseType: "LICENSED",
            isPlayable: true,
            durationSeconds: 2,
          },
        },
      },
      include: { videoAssets: true },
    })
    titles.push(native.id)
    const nativeAsset = native.videoAssets[0]
    await ownerPage.goto(`${base}/watch/${nativeAsset.id}`)
    const nativeStart = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/playback/sessions") &&
        response.request().method() === "POST"
    )
    const nativeProgress = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/progress") &&
        response.request().method() === "PUT"
    )
    await ownerPage
      .getByRole("button", { name: /^Play(?:\s|\(|$)/i })
      .first()
      .click()
    expect((await nativeStart).status()).toBe(200)
    expect((await nativeProgress).status()).toBe(200)
    expect(
      await db.playbackSession.count({
        where: { videoAssetId: nativeAsset.id },
      })
    ).toBe(1)
    expect(
      (
        await db.playbackSession.findFirstOrThrow({
          where: { videoAssetId: nativeAsset.id },
        })
      ).watchedMilliseconds
    ).toBeGreaterThan(0)
    const brokenAsset = await db.videoAsset.create({
      data: {
        contentId: native.id,
        sourceType: "REMOTE_URL",
        playbackUrl: "https://media.example.test/missing.webm",
        licenseType: "LICENSED",
        isPlayable: true,
      },
    })
    await ownerPage.route("https://media.example.test/missing.webm", (route) =>
      route.fulfill({ status: 404 })
    )
    await ownerPage.goto(`${base}/watch/${brokenAsset.id}`)
    await expect(
      ownerPage
        .getByRole("alert")
        .filter({ hasText: "unavailable or unsupported" })
    ).toBeVisible()
    await ownerPage.getByRole("button", { name: "Play", exact: true }).click()
    await expect(
      ownerPage.getByRole("alert").filter({ hasText: "could not start" })
    ).toBeVisible()
    expect(
      await db.playbackSession.count({
        where: { videoAssetId: brokenAsset.id },
      })
    ).toBe(0)
    pass(
      "real native WebM decoding/playback and persisted progress; unsupported media handled without unhandled rejection or false stream"
    )
    expect(errors).toEqual([])
    ownerPage.removeAllListeners("pageerror")
    const liveYouTube = {
      iframeLoaded: false,
      playbackStarted: false,
      limitation: "",
    }
    await ownerPage.unroute("https://www.youtube.com/iframe_api")
    try {
      await ownerPage.goto(`${base}/watch/${asset.id}`)
      await expect(
        ownerPage.locator(
          'iframe[src*="youtube-nocookie.com/embed/M7lc1UVf-VE"]'
        )
      ).toBeVisible({ timeout: 25000 })
      liveYouTube.iframeLoaded = true
      await Promise.all([
        ownerPage.waitForResponse(
          (response) =>
            response.url().endsWith("/api/playback/sessions") &&
            response.status() === 200,
          { timeout: 12000 }
        ),
        ownerPage
          .frameLocator("iframe")
          .getByRole("button", { name: "Play", exact: true })
          .click({ timeout: 12000 }),
      ])
      liveYouTube.playbackStarted = true
    } catch {
      liveYouTube.limitation =
        "Live YouTube playback could not be confirmed in this browser session; simulated API behavior and native playback were verified separately."
    }
    await ownerContext.close()
    writeFileSync(
      `${output}/rights-playback-results.json`,
      JSON.stringify({ checks, errors, liveYouTube }, null, 2)
    )
    console.log(
      JSON.stringify(
        { checks, browserErrors: errors.length, liveYouTube },
        null,
        2
      )
    )
  } finally {
    await browser.close()
    const owner = await db.user.findUnique({
      where: { email: ownerEmail },
      include: { rightsHolderMemberships: true },
    })
    holderId ??= owner?.rightsHolderMemberships[0]?.rightsHolderId
    await db.content.deleteMany({ where: { id: { in: titles } } })
    await db.user.deleteMany({
      where: { OR: [{ id: { in: users } }, { email: ownerEmail }] },
    })
    if (holderId) await db.rightsHolder.deleteMany({ where: { id: holderId } })
    await db.auditLog.deleteMany({ where: { actorId: adminId } })
    await db.$disconnect()
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message.replaceAll(password, "[redacted]")
      : "Browser QA failed"
  )
  process.exitCode = 1
})
