import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { getPrisma } from "@/lib/prisma"
import { getAuth } from "@/lib/auth"
import { mutateAdmin } from "@/services/admin/operations"
import {
  startPlaybackSession,
  recordPlaybackSample,
} from "@/services/viewer/playback-operations"
import { getAnalytics, analyticsCsv } from "@/services/analytics/operations"
const db = getPrisma(),
  suffix = crypto.randomUUID(),
  adminId = `rights-admin-${suffix}`,
  viewerId = `rights-viewer-${suffix}`
const users = [adminId, viewerId],
  holderIds: string[] = [],
  contentIds: string[] = []
let ownerId: string,
  holderId: string,
  profileId: string,
  assetId: string,
  contentId: string
const change = (path: string, method: string, body: unknown, actor = adminId) =>
  mutateAdmin(
    new URL(`http://localhost:3000/api/admin/${path}`),
    method,
    body,
    actor
  )
const auth = (path: string, body: unknown, cookie = "") =>
  getAuth().handler(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(body),
    })
  )
beforeAll(async () => {
  await db.user.createMany({
    data: [
      {
        id: adminId,
        name: "Test Admin",
        email: `${adminId}@example.test`,
        role: "ADMIN",
      },
      { id: viewerId, name: "Test Viewer", email: `${viewerId}@example.test` },
    ],
  })
  profileId = (
    await db.viewerProfile.create({
      data: { userId: viewerId, name: "Viewer" },
    })
  ).id
})
afterAll(async () => {
  await db.content.deleteMany({ where: { id: { in: contentIds } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.rightsHolder.deleteMany({ where: { id: { in: holderIds } } })
  await db.auditLog.deleteMany({ where: { actorId: adminId } })
})
describe("rights-holder account and viewing lifecycle", () => {
  it("creates an owner, credentials, profile and membership atomically, then signs in and changes the password", async () => {
    const email = `owner-${suffix}@example.test`
    const result = await change("users", "POST", {
      name: "Owner Contact",
      email,
      password: "initial-owner-password",
      rightsHolder: {
        name: `Owner ${suffix}`,
        phone: "+233 20 123 4567",
        address: "Accra",
        website: "https://example.test",
        notes: "PRIVATE NOTES",
      },
    })
    ownerId = result.id
    users.push(ownerId)
    const owner = await db.user.findUniqueOrThrow({
      where: { id: ownerId },
      include: {
        rightsHolderMemberships: true,
        accounts: true,
        profiles: true,
      },
    })
    holderId = owner.rightsHolderMemberships[0].rightsHolderId
    holderIds.push(holderId)
    expect(owner.role).toBe("RIGHTS_HOLDER")
    expect(owner.profiles).toHaveLength(1)
    expect(owner.accounts[0].password).not.toBe("initial-owner-password")
    expect(result).toEqual({ id: ownerId })
    const login = await auth("sign-in/email", {
      email,
      password: "initial-owner-password",
    })
    expect(login.status).toBe(200)
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    expect(
      (
        await auth(
          "change-password",
          {
            currentPassword: "initial-owner-password",
            newPassword: "new-owner-password",
            revokeOtherSessions: true,
          },
          cookie
        )
      ).status
    ).toBe(200)
    expect(
      (await auth("sign-in/email", { email, password: "new-owner-password" }))
        .status
    ).toBe(200)
    await expect(
      change("users", "POST", {
        name: "Duplicate",
        email,
        password: "duplicate-password",
        rightsHolderId: holderId,
      })
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" })
    await expect(
      change(
        "users",
        "POST",
        {
          name: "Unauthorized",
          email: `bad-${suffix}@example.test`,
          password: "initial-password",
          rightsHolderId: holderId,
        },
        viewerId
      )
    ).rejects.toMatchObject({ code: "ADMIN_REQUIRED" })
  })
  it("links an existing viewer without replacing credentials and validates membership", async () => {
    await expect(
      change(`users/${viewerId}`, "PATCH", {
        role: "RIGHTS_HOLDER",
        isSuspended: false,
      })
    ).rejects.toThrow()
    await change(`users/${viewerId}`, "PATCH", {
      role: "RIGHTS_HOLDER",
      isSuspended: false,
      rightsHolderIds: [holderId],
    })
    expect(
      await db.rightsHolderMembership.count({ where: { userId: viewerId } })
    ).toBe(1)
    await change(`users/${viewerId}`, "PATCH", {
      role: "VIEWER",
      isSuspended: false,
    })
    expect(
      await db.rightsHolderMembership.count({ where: { userId: viewerId } })
    ).toBe(0)
  })
  it("records an immediate stream with zero watch time and deduplicates concurrent starts", async () => {
    const title = await db.content.create({
      data: {
        title: `=Private ${suffix}`,
        slug: `play-${suffix}`,
        shortDescription: "Viewing test",
        description: "Viewing test",
        contentType: "MOVIE",
        publicationStatus: "PUBLISHED",
        rightsHolderId: holderId,
        videoAssets: {
          create: {
            sourceType: "REMOTE_URL",
            playbackUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            licenseType: "LICENSED",
            isPlayable: true,
            durationSeconds: 100,
          },
        },
      },
      include: { videoAssets: true },
    })
    contentId = title.id
    contentIds.push(contentId)
    assetId = title.videoAssets[0].id
    const input = { videoAssetId: assetId, idempotencyKey: crypto.randomUUID() }
    const sessions = await Promise.all([
      startPlaybackSession(viewerId, profileId, input),
      startPlaybackSession(viewerId, profileId, input),
    ])
    expect(sessions[0].id).toBe(sessions[1].id)
    const report = await getAnalytics(ownerId, { range: "all", contentId })
    expect(report.summary.streams).toBe(1)
    expect(report.summary.watchSeconds).toBe(0)
    expect(report.summary.completionRate).toBe(0)
    expect(JSON.stringify(report)).not.toContain("PRIVATE NOTES")
    expect(analyticsCsv(report)).toContain("\"'=Private")
  })
  it("deduplicates samples, rejects foreign sessions and counts only watched coverage", async () => {
    const session = await db.playbackSession.findFirstOrThrow({
      where: { videoAssetId: assetId },
    })
    await db.playbackSession.update({
      where: { id: session.id },
      data: {
        startedAt: new Date(Date.now() - 100000),
        lastSampleAt: new Date(Date.now() - 100000),
      },
    })
    const telemetry = {
      sessionId: session.id,
      sequence: 1,
      watchedMilliseconds: 91000,
      coverage: [[0, 91] as [number, number]],
    }
    await db.$transaction((tx) =>
      recordPlaybackSample(tx, viewerId, profileId, assetId, telemetry, 100)
    )
    await db.$transaction((tx) =>
      recordPlaybackSample(tx, viewerId, profileId, assetId, telemetry, 100)
    )
    expect(
      await db.playbackSample.count({ where: { sessionId: session.id } })
    ).toBe(1)
    const report = await getAnalytics(ownerId, { range: "all", contentId })
    expect(report.summary.watchSeconds).toBe(91)
    expect(report.summary.completionRate).toBe(100)
    await expect(
      db.$transaction((tx) =>
        recordPlaybackSample(
          tx,
          ownerId,
          profileId,
          assetId,
          { ...telemetry, sequence: 2 },
          100
        )
      )
    ).rejects.toMatchObject({ code: "SESSION_NOT_OWNED" })
    await expect(
      getAnalytics(viewerId, { range: "all" })
    ).rejects.toMatchObject({ code: "REPORTS_FORBIDDEN" })
    const other = await db.content.create({
      data: {
        title: "Other owner",
        slug: `other-${suffix}`,
        shortDescription: "Other",
        description: "Other",
        contentType: "MOVIE",
      },
    })
    contentIds.push(other.id)
    await expect(
      getAnalytics(ownerId, { contentId: other.id })
    ).rejects.toMatchObject({ code: "TITLE_NOT_FOUND" })
  })
  it("counts a reopened video immediately, including a sub-second viewing session", async () => {
    const next = await startPlaybackSession(viewerId, profileId, {
      videoAssetId: assetId,
      idempotencyKey: crypto.randomUUID(),
    })
    expect(
      (await getAnalytics(ownerId, { range: "all", contentId })).summary.streams
    ).toBe(2)
    await db.$transaction((tx) =>
      recordPlaybackSample(
        tx,
        viewerId,
        profileId,
        assetId,
        {
          sessionId: next.id,
          sequence: 1,
          watchedMilliseconds: 500,
          coverage: [[0, 0.5]],
        },
        100
      )
    )
    const report = await getAnalytics(ownerId, { range: "all", contentId })
    expect(report.summary.watchSeconds).toBe(91.5)
    expect(report.summary.streams).toBe(2)
    expect(report.summary.completionRate).toBe(50)
    await expect(
      db.$transaction((tx) =>
        recordPlaybackSample(
          tx,
          viewerId,
          profileId,
          assetId,
          {
            sessionId: next.id,
            sequence: 2,
            watchedMilliseconds: 501,
            coverage: [[0, 100]],
          },
          100
        )
      )
    ).rejects.toMatchObject({ code: "INVALID_COVERAGE" })
  })
  it("uses UTC boundaries and rolls episode viewing into the parent series", async () => {
    const series = await db.content.create({
      data: {
        title: "Boundary series",
        slug: `boundary-${suffix}`,
        shortDescription: "Boundary",
        description: "Boundary",
        contentType: "SERIES",
        publicationStatus: "PUBLISHED",
        rightsHolderId: holderId,
        seasons: {
          create: {
            seasonNumber: 1,
            episodes: {
              create: {
                episodeNumber: 1,
                title: "First episode",
                videoAssets: {
                  create: {
                    sourceType: "DEMO",
                    playbackUrl: "/media/test.webm",
                    licenseType: "DEMO",
                    isPlayable: true,
                  },
                },
              },
            },
          },
        },
      },
      include: {
        seasons: { include: { episodes: { include: { videoAssets: true } } } },
      },
    })
    contentIds.push(series.id)
    const episode = series.seasons[0].episodes[0]
    for (const date of [
      "2026-10-09T00:00:00.000Z",
      "2026-10-08T23:59:59.999Z",
      "2026-10-16T00:00:00.000Z",
    ]) {
      const session = await db.playbackSession.create({
        data: {
          userId: viewerId,
          profileId,
          contentId: series.id,
          episodeId: episode.id,
          videoAssetId: episode.videoAssets[0].id,
          idempotencyKey: crypto.randomUUID(),
          startedAt: new Date(date),
        },
      })
      await db.playbackSample.create({
        data: {
          sessionId: session.id,
          sequence: 1,
          watchedMilliseconds: 4000,
          createdAt: new Date(date),
        },
      })
    }
    const report = await getAnalytics(
      ownerId,
      { range: "7", contentId: series.id },
      new Date("2026-10-15T12:00:00Z")
    )
    expect(report.summary.streams).toBe(1)
    expect(report.summary.watchSeconds).toBe(4)
    expect(report.episodes[0].streams).toBe(1)
    expect(report.daily).toEqual([
      { day: "2026-10-09", streams: 1, watchSeconds: 4 },
    ])
  })
  it("supports shared organizations and multiple memberships without exposing other owners", async () => {
    const holder = await db.rightsHolder.create({
      data: { name: `Second ${suffix}` },
    })
    holderIds.push(holder.id)
    await change(`users/${viewerId}`, "PATCH", {
      role: "RIGHTS_HOLDER",
      isSuspended: false,
      rightsHolderIds: [holder.id],
    })
    await expect(getAnalytics(viewerId, { contentId })).rejects.toMatchObject({
      code: "TITLE_NOT_FOUND",
    })
    await change(`users/${viewerId}`, "PATCH", {
      role: "RIGHTS_HOLDER",
      isSuspended: false,
      rightsHolderIds: [holder.id, holderId],
    })
    expect((await getAnalytics(viewerId, { contentId })).summary.streams).toBe(
      2
    )
    await db.user.update({
      where: { id: viewerId },
      data: { isSuspended: true },
    })
    await expect(getAnalytics(viewerId, {})).rejects.toMatchObject({
      code: "REPORTS_FORBIDDEN",
    })
    await change(`users/${viewerId}`, "PATCH", {
      role: "VIEWER",
      isSuspended: false,
    })
  })
  it("rolls back failed account creation without leaving an orphaned account", async () => {
    const email = `rollback-${suffix}@example.test`
    await expect(
      change("users", "POST", {
        name: "Rollback",
        email,
        password: "initial-password",
        rightsHolder: { name: `Owner ${suffix}` },
      })
    ).rejects.toMatchObject({ code: "P2002" })
    expect(await db.user.count({ where: { email } })).toBe(0)
  })
  it("blocks premium YouTube mutation and revokes owner access without removing content ownership", async () => {
    await db.content.update({
      where: { id: contentId },
      data: { publicationStatus: "DRAFT" },
    })
    await expect(
      change(`content/${contentId}`, "PATCH", {
        title: "Premium",
        shortDescription: "Premium",
        description: "Premium",
        contentType: "MOVIE",
        isPremium: true,
      })
    ).rejects.toMatchObject({ code: "YOUTUBE_PREMIUM" })
    await change(`users/${ownerId}`, "PATCH", {
      role: "VIEWER",
      isSuspended: false,
    })
    await expect(getAnalytics(ownerId, { range: "all" })).rejects.toMatchObject(
      { code: "REPORTS_FORBIDDEN" }
    )
    expect(
      (await db.content.findUniqueOrThrow({ where: { id: contentId } }))
        .rightsHolderId
    ).toBe(holderId)
    expect(await db.session.count({ where: { userId: ownerId } })).toBe(0)
  })
})
