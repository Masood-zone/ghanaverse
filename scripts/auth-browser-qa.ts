import "dotenv/config"
import {
  chromium,
  expect as baseExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"
import { randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { once } from "node:events"
import { resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

// Run against the prepared disposable database, never the development catalogue.
const testUrl = process.env.TEST_DATABASE_URL
if (
  !testUrl ||
  new URL(testUrl).searchParams.get("schema") !== "ghanaverse_test"
)
  throw new Error("Run pnpm test:prepare before pnpm qa:auth")
if (!existsSync(".next/BUILD_ID"))
  throw new Error("Run pnpm exec next build first")
const origin = "http://localhost:3100"
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: testUrl },
    { schema: "ghanaverse_test" }
  ),
})
const output = resolve("artifacts/implementation-qa/auth")
mkdirSync(output, { recursive: true })
const suffix = crypto.randomUUID()
const emails: string[] = []
const password = randomBytes(20).toString("base64url")
const nextPassword = randomBytes(20).toString("base64url")
const checks: string[] = [],
  errors: string[] = []
const expect = baseExpect.configure({ timeout: 15000 })

async function respectRateLimit(headers: Record<string, string>) {
  const seconds = Number(
    headers["x-retry-after"] ?? headers["retry-after"] ?? 1
  )
  if (!Number.isFinite(seconds) || seconds > 60)
    throw new Error("Unexpected authentication rate-limit delay")
  await delay(Math.max(1, seconds) * 1000 + 100)
}
async function authPost(
  context: BrowserContext,
  path: string,
  data: Record<string, string>
) {
  const send = () =>
    context.request.post(`${origin}/api/auth/${path}`, {
      headers: { origin },
      data,
    })
  let response = await send()
  if (response.status() === 429) {
    await respectRateLimit(response.headers())
    response = await send()
  }
  expect(
    response.status(),
    "Authentication remained rate limited after Retry-After"
  ).not.toBe(429)
  return response
}

async function login(
  page: Page,
  email: string,
  destination = "/account",
  credential = password
) {
  await page.goto(
    `${origin}/auth?callbackUrl=${encodeURIComponent(destination)}`
  )
  await page.getByLabel("Email address", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(credential)
  const submit = async () => {
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/sign-in/email") &&
        response.request().method() === "POST"
    )
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    return response
  }
  const response = await submit()
  if (response.status() === 429) {
    await respectRateLimit(response.headers())
    expect((await submit()).status()).not.toBe(429)
  }
}
async function logout(page: Page) {
  await page.getByLabel("Account menu", { exact: true }).click()
  await page
    .getByRole("button", { name: "Sign Out", exact: true })
    .filter({ visible: true })
    .first()
    .click()
}
async function register(context: BrowserContext, label: string) {
  const email = `auth-qa-${label}-${suffix}@example.test`
  emails.push(email)
  const response = await authPost(context, "sign-up/email", {
    name: `Auth QA ${label}`,
    email,
    password,
  })
  expect(response.status()).toBe(200)
  return db.user.findUniqueOrThrow({ where: { email } })
}

async function main() {
  const log = resolve(output, "server.log")
  writeFileSync(log, "")
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "localhost",
      "--port",
      "3100",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: testUrl,
        BETTER_AUTH_URL: origin,
        NODE_ENV: "production",
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    await new Promise<void>((resolveReady, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Test server did not become ready; see ${log}`)),
        45000
      )
      server.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString()
        appendFileSync(log, text)
        if (text.includes("Ready in")) {
          clearTimeout(timeout)
          resolveReady()
        }
      })
      server.stderr.on("data", (chunk: Buffer) => appendFileSync(log, chunk))
      server.once("error", (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      server.once("exit", (code) => {
        clearTimeout(timeout)
        reject(new Error(`Test server exited (${code}); see ${log}`))
      })
    })
    browser = await chromium.launch({
      ...(existsSync(chromium.executablePath()) ? {} : { channel: "msedge" }),
      headless: true,
      args: ["--no-proxy-server"],
    })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    })
    context.setDefaultTimeout(15000)
    await context.tracing.start({ screenshots: true, snapshots: true })
    const page = await context.newPage()
    context.on("page", (tab) =>
      tab.on("pageerror", (error) => errors.push(error.message))
    )
    page.on("pageerror", (error) => errors.push(error.message))
    try {
      const adminPages = [
        "",
        "/activity",
        "/analytics",
        "/collections",
        "/content",
        "/content/new",
        "/content/missing/preview",
        "/creators",
        "/metadata",
        "/royalties",
        "/storage",
        "/users",
      ].map((path) => `/admin${path}`)
      const protectedPages = [
        ...adminPages,
        "/account",
        "/library",
        "/profiles",
        "/creator/content",
        "/creator/content/new",
        "/creator/content/missing/preview",
        "/creator/analytics",
        "/watch/missing",
      ]
      for (const path of protectedPages) {
        const destination = `${path}?tab=history&section=video`
        await page.goto(origin + destination)
        await expect(page).toHaveURL(
          (url) =>
            url.pathname === "/auth" &&
            url.searchParams.get("callbackUrl") === destination
        )
      }
      expect(
        (await context.request.get(`${origin}/api/account`)).status()
      ).toBe(401)
      expect(
        (await context.request.get(`${origin}/api/admin/users`)).status()
      ).toBe(401)
      checks.push(
        `anonymous access and deep-link callbacks: ${protectedPages.length} protected pages and account/admin APIs`
      )

      await context.addCookies([
        { name: "better-auth.session_token", value: "forged", url: origin },
      ])
      expect(
        (await context.request.get(`${origin}/api/account`)).status()
      ).toBe(401)
      await context.clearCookies()
      const email = `auth-qa-viewer-${suffix}@example.test`
      emails.push(email)
      const destination = "/library?tab=history&page=2"
      await login(page, email, destination, "incorrect-password")
      await expect(
        page.getByText(
          "Unable to sign in. Please check your email and password.",
          { exact: true }
        )
      ).toBeVisible()
      await page
        .getByRole("button", { name: "New here? Create an account" })
        .click()
      await page.getByLabel("Full name", { exact: true }).fill("Auth QA Viewer")
      await page.getByLabel("Password", { exact: true }).fill(password)
      await page.getByLabel(/^Confirm password/).fill("does-not-match")
      await page
        .getByRole("button", { name: "Create Account", exact: true })
        .click()
      await expect(
        page.getByText("Passwords do not match", { exact: true })
      ).toBeVisible()
      await page.getByLabel(/^Confirm password/).fill(password)
      await page
        .getByRole("button", { name: "Create Account", exact: true })
        .click()
      await expect(page).toHaveURL(origin + destination)
      await expect(
        page.getByText("Welcome to GhanaVerse, Auth QA Viewer!", {
          exact: true,
        })
      ).toBeVisible()
      const viewer = await db.user.findUniqueOrThrow({ where: { email } })
      expect(
        await db.viewerProfile.count({ where: { userId: viewer.id } })
      ).toBe(1)
      expect(
        (await context.request.get(`${origin}/api/admin/users`)).status()
      ).toBe(403)
      await page.goto(`${origin}/creator/content`)
      await expect(
        page.getByRole("heading", { name: "Rights-holder workspace" })
      ).toBeVisible()
      await page.goto(`${origin}/admin/users`)
      await expect(page).toHaveURL(origin + "/")
      await page.goto(
        `${origin}/auth/continue?callbackUrl=${encodeURIComponent("//outside.example")}`
      )
      await expect(page).toHaveURL(origin + "/")
      checks.push(
        "forged session, invalid login, password confirmation, registration, welcome, single profile, role denial and safe callbacks"
      )

      await page.goto(`${origin}/account`)
      await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Auth QA Viewer"
      )
      await page.route("**/api/auth/sign-out", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary sign-out failure" }),
        })
      )
      await logout(page)
      await expect(
        page.getByText("Sign-out could not be completed. Please try again.", {
          exact: true,
        })
      ).toBeVisible()
      expect(
        (await context.request.get(`${origin}/api/account`)).status()
      ).toBe(200)
      await page.unroute("**/api/auth/sign-out")
      // The failed attempt leaves the account menu open.
      await page
        .getByRole("button", { name: "Sign Out", exact: true })
        .filter({ visible: true })
        .first()
        .click()
      await expect(page).toHaveURL(origin + "/")
      checks.push(
        "failed logout keeps the account usable; successful retry clears the session"
      )

      await db.viewerProfile.create({
        data: { userId: viewer.id, name: "QA Second Profile" },
      })
      await login(page, email, destination)
      await expect(page).toHaveURL(
        `${origin}/profiles?callbackUrl=${encodeURIComponent(destination)}`
      )
      await page
        .getByRole("button", { name: "Select My Profile", exact: true })
        .click()
      await expect(page).toHaveURL(origin + destination)
      await page.goto(`${origin}/account`)
      await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        "Auth QA Viewer"
      )
      const otherTab = await context.newPage()
      await otherTab.goto(`${origin}/account`)
      await expect(
        otherTab.getByLabel("Full name", { exact: true })
      ).toHaveValue("Auth QA Viewer")
      await page.bringToFront()
      await logout(page)
      await expect(page).toHaveURL(origin + "/")
      await expect(otherTab).toHaveURL(
        (url) =>
          url.pathname === "/auth" &&
          url.searchParams.get("callbackUrl") === "/account"
      )
      expect(
        (await context.request.get(`${origin}/api/account`)).status()
      ).toBe(401)
      await otherTab.close()
      checks.push(
        "multiple-profile selection preserves callback; Better Auth cross-tab logout removes protected content"
      )

      await login(page, email, "/account")
      await expect(page).toHaveURL(/\/profiles\?/)
      await page
        .getByRole("button", { name: "Select My Profile", exact: true })
        .click()
      await expect(page).toHaveURL(origin + "/account")
      const oldSession = await browser.newContext()
      expect(
        (
          await authPost(oldSession, "sign-in/email", { email, password })
        ).status()
      ).toBe(200)
      await page.getByLabel("Current password", { exact: true }).fill(password)
      await page.getByLabel("New password", { exact: true }).fill(nextPassword)
      await page
        .getByLabel("Confirm new password", { exact: true })
        .fill(nextPassword)
      await page
        .getByRole("button", { name: "Change password", exact: true })
        .click()
      await expect(
        page.getByText("Password changed successfully.", { exact: true })
      ).toBeVisible()
      expect(
        (await context.request.get(`${origin}/api/account`)).status()
      ).toBe(200)
      expect(
        (await oldSession.request.get(`${origin}/api/account`)).status()
      ).toBe(401)
      await oldSession.close()
      await logout(page)
      await expect(page).toHaveURL(origin + "/")
      const alternate = await register(context, "alternate")
      await page.goto(`${origin}/account`)
      await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
        alternate.name
      )
      await expect(
        page.getByLabel("Full name", { exact: true })
      ).not.toHaveValue(viewer.name)
      checks.push(
        "password change revokes other sessions; switching accounts does not show the previous account data"
      )

      const adminContext = await browser.newContext()
      const admin = await register(adminContext, "administrator")
      await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } })
      const adminPage = await adminContext.newPage()
      await adminPage.goto(`${origin}/admin/users`)
      await expect(
        adminPage.getByRole("navigation", {
          name: "Administration",
          exact: true,
        })
      ).toBeVisible()
      expect(
        (await adminContext.request.get(`${origin}/api/admin/users`)).status()
      ).toBe(200)
      const changed = await adminContext.request.patch(
        `${origin}/api/admin/users/${alternate.id}`,
        { headers: { origin }, data: { role: "VIEWER", isSuspended: true } }
      )
      expect(changed.status()).toBe(200)
      expect(
        (await context.request.get(`${origin}/api/account`)).status()
      ).toBe(401)
      await page.goto(`${origin}/account?section=security`)
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/auth" &&
          url.searchParams.get("callbackUrl") === "/account?section=security"
      )
      expect(
        (
          await authPost(context, "sign-in/email", {
            email: alternate.email,
            password,
          })
        ).status()
      ).not.toBe(200)

      // Expiration must be enforced even when a correctly signed cookie is still present.
      expect(
        (
          await authPost(context, "sign-in/email", {
            email,
            password: nextPassword,
          })
        ).status()
      ).toBe(200)
      await db.session.updateMany({
        where: { userId: viewer.id },
        data: { expiresAt: new Date(0) },
      })
      expect(
        (await context.request.get(`${origin}/api/account`)).status()
      ).toBe(401)
      await page.goto(`${origin}/library?tab=history&page=2`)
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/auth" &&
          url.searchParams.get("callbackUrl") === destination
      )

      const backupEmail = `auth-qa-backup-${suffix}@example.test`
      emails.push(backupEmail)
      await db.user.create({
        data: {
          id: crypto.randomUUID(),
          name: "QA Backup Admin",
          email: backupEmail,
          role: "ADMIN",
        },
      })
      expect(
        (
          await adminContext.request.patch(
            `${origin}/api/admin/users/${admin.id}`,
            {
              headers: { origin },
              data: { role: "VIEWER", isSuspended: false },
            }
          )
        ).status()
      ).toBe(200)
      expect(
        (await adminContext.request.get(`${origin}/api/admin/users`)).status()
      ).toBe(401)
      await adminPage.goto(`${origin}/admin/content/new?section=video`)
      await expect(adminPage).toHaveURL(
        (url) =>
          url.pathname === "/auth" &&
          url.searchParams.get("callbackUrl") ===
            "/admin/content/new?section=video"
      )
      await adminContext.close()
      checks.push(
        "administrator pages/API, suspension, expiration and role-change revocation preserve authoritative access and callbacks"
      )

      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${origin}/auth`)
      await expect(
        page.getByRole("heading", { name: "Welcome back", exact: true })
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await page.screenshot({
        path: resolve(output, "auth-390.png"),
        fullPage: true,
      })
      expect(errors).toEqual([])
      checks.push("mobile auth rendering and browser console")
    } finally {
      writeFileSync(
        resolve(output, "results.json"),
        JSON.stringify({ checks, errors }, null, 2)
      )
      await page
        .screenshot({ path: resolve(output, "last-page.png"), fullPage: true })
        .catch(() => {})
      await context.tracing.stop({ path: resolve(output, "trace.zip") })
      await context.close()
    }
    writeFileSync(
      resolve(output, "results.json"),
      JSON.stringify({ checks, errors }, null, 2)
    )
    console.log(JSON.stringify({ checks, errors }, null, 2))
  } finally {
    await browser?.close()
    const users = await db.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    })
    await db.auditLog.deleteMany({
      where: { actorId: { in: users.map((user) => user.id) } },
    })
    await db.user.deleteMany({ where: { email: { in: emails } } })
    await db.$disconnect()
    if (server.exitCode === null) {
      const stopped = once(server, "exit")
      server.kill()
      await stopped
    }
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Auth browser QA failed"
  )
  process.exitCode = 1
})
