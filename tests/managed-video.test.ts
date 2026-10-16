import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { createHash, randomUUID } from "node:crypto"
vi.mock("@/lib/video/inspect-mp4", () => ({
  inspectMp4Header: vi.fn(() => metadata),
}))
vi.mock("@/lib/video/process-media", () => ({ prepareVideo: vi.fn() }))
import { inspectMp4Header } from "@/lib/video/inspect-mp4"
import { prepareVideo } from "@/lib/video/process-media"
import {
  heartbeatVideoProcessor,
  processNextVideo,
} from "@/services/video/processing"
import { videoContentType } from "@/lib/video/constants"
import { PlatformError } from "@/lib/platform-error"
import { getPrisma } from "@/lib/prisma"
import { r2 } from "@/lib/r2/provider"
import {
  createVideoUpload,
  reconcileVideoUpload,
  signVideoPart,
  completeVideoUpload,
  cancelVideoUpload,
  cleanupVideoStorage,
  listVideoUploads,
} from "@/services/video/uploads"
import { storageUsage } from "@/services/video/storage"
import { mutateCreatorContent, readCreator } from "@/services/content/creator"
import { mutateAdmin } from "@/services/admin/operations"
import { selectVideoAsset, playbackSource } from "@/services/video/playback"
import { videoMetadataSchema } from "@/lib/validation/video"
import { VIDEO_PART_BYTES } from "@/lib/video/constants"

const metadata = {
  durationSeconds: 12,
  width: 320,
  height: 180,
  videoCodec: "avc1.64001f",
  audioCodecs: ["mp4a.40.2"],
  progressive: true as const,
}
const db = getPrisma(),
  suffix = randomUUID()
const admin = `r2-admin-${suffix}`,
  owner = `r2-owner-${suffix}`,
  other = `r2-other-${suffix}`,
  viewer = `r2-viewer-${suffix}`
const contentIds: string[] = []
let holderId: string,
  secondHolder: string,
  genreId: string,
  languageId: string,
  companyId: string,
  profileId: string
const objects = new Map<
  string,
  { bytes: number; etag: string; contentType: string; sessionId: string }
>()
const parts = new Map<
  string,
  { partNumber: number; size: number; etag: string }[]
>()
const digest = createHash("md5").update("test-data").digest("hex")
const signed = vi.spyOn(r2, "signPart").mockResolvedValue({
  url: "https://r2.invalid/signed",
  contentMD5: "unused",
  expiresAt: new Date().toISOString(),
})
vi.spyOn(r2, "initialize").mockImplementation(
  async (s) => `provider-${s.objectKey}`
)
vi.spyOn(r2, "parts").mockImplementation(
  async (s) => parts.get(s.objectKey) ?? []
)
vi.spyOn(r2, "head").mockImplementation(
  async (s) => objects.get(s.objectKey) ?? null
)
vi.spyOn(r2, "readHeader").mockResolvedValue(new ArrayBuffer(32))
const complete = vi
  .spyOn(r2, "complete")
  .mockImplementation(async (s, uploaded) => {
    const session = await db.videoUploadSession.findUniqueOrThrow({
      where: { objectKey: s.objectKey },
    })
    objects.set(s.objectKey, {
      bytes: Number(session.fileSize),
      contentType: videoContentType(s.objectKey)!,
      sessionId: session.id,
      etag: `"${createHash("md5")
        .update(
          Buffer.concat(
            uploaded.map((p) => Buffer.from(p.etag.replaceAll('"', ""), "hex"))
          )
        )
        .digest("hex")}-${uploaded.length}"`,
    })
  })
const abort = vi.spyOn(r2, "abort").mockResolvedValue()
vi.spyOn(r2, "download").mockResolvedValue()
vi.spyOn(r2, "uploadPrepared").mockImplementation(
  async (target, id, _path, bytes) => {
    objects.set(target.objectKey, {
      bytes,
      etag: "prepared-etag",
      contentType: videoContentType(target.objectKey)!,
      sessionId: id,
    })
  }
)
const remove = vi.spyOn(r2, "delete").mockImplementation(async (s) => {
  objects.delete(s.objectKey)
})
vi.spyOn(r2, "playback").mockResolvedValue({
  url: "https://r2.invalid/authorized.mp4",
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
})
const change = (path: string, method: string, body: unknown, actor = owner) =>
  mutateCreatorContent(
    new URL(`http://localhost:3000/api/creator/${path}`),
    method,
    body,
    actor
  )
const baseFields = () => ({
  title: `R2 title ${randomUUID()}`,
  shortDescription: "Upload test",
  description: "Upload test record",
  contentType: "MOVIE" as const,
  rightsHolderId: holderId,
  mediaRights: "ORIGINAL" as const,
})
async function title(series = false) {
  const record = await db.content.create({
    data: {
      ...baseFields(),
      contentType: series ? "SERIES" : "MOVIE",
      slug: randomUUID(),
      classification: "PG",
    },
  })
  contentIds.push(record.id)
  return record
}
function input(contentId: string, fileSize = 100) {
  return {
    idempotencyKey: randomUUID(),
    contentId,
    episodeId: null,
    filename: "test.mp4",
    fileSize,
    lastModified: 1234,
    fingerprint: "a".repeat(64),
    licenseType: "ORIGINAL",
    mediaMetadata: metadata,
  }
}
async function uploaded(
  contentId: string,
  episodeId: string | null = null,
  filename = "test.mp4"
) {
  const session = await createVideoUpload(owner, {
    ...input(contentId),
    episodeId,
    filename,
    mediaMetadata: filename.endsWith(".mp4") ? metadata : null,
  })
  await signVideoPart(owner, session.id, { partNumber: 1, md5: digest })
  const stored = await db.videoUploadSession.findUniqueOrThrow({
    where: { id: session.id },
  })
  parts.set(stored.objectKey, [
    { partNumber: 1, size: 100, etag: `"${digest}"` },
  ])
  return session
}
beforeAll(async () => {
  vi.stubEnv(
    "R2_ENDPOINT",
    `https://${"0".repeat(32)}.r2.cloudflarestorage.com`
  )
  vi.stubEnv("R2_BUCKET_NAME", "test-videos")
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key")
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
  vi.stubEnv("R2_STORAGE_BUDGET_BYTES", "8000000000")
  await db.user.createMany({
    data: [
      {
        id: admin,
        name: "Admin",
        email: `${admin}@example.test`,
        role: "ADMIN",
      },
      {
        id: owner,
        name: "Owner",
        email: `${owner}@example.test`,
        role: "RIGHTS_HOLDER",
      },
      {
        id: other,
        name: "Other",
        email: `${other}@example.test`,
        role: "RIGHTS_HOLDER",
      },
      { id: viewer, name: "Viewer", email: `${viewer}@example.test` },
    ],
  })
  holderId = (
    await db.rightsHolder.create({
      data: {
        name: `R2 Holder ${suffix}`,
        contactEmail: "private@example.test",
        notes: "private",
        memberships: { create: { userId: owner } },
      },
    })
  ).id
  secondHolder = (
    await db.rightsHolder.create({
      data: {
        name: `R2 Other ${suffix}`,
        memberships: { create: { userId: other } },
      },
    })
  ).id
  genreId = (
    await db.genre.create({
      data: { name: `R2 Genre ${suffix}`, slug: suffix },
    })
  ).id
  languageId = (
    await db.language.create({
      data: { name: `R2 Language ${suffix}`, code: suffix },
    })
  ).id
  companyId = (
    await db.productionCompany.create({
      data: { name: `R2 Company ${suffix}` },
    })
  ).id
  profileId = (
    await db.viewerProfile.create({ data: { userId: viewer, name: "Viewer" } })
  ).id
})
afterEach(() => {
  vi.stubEnv("R2_STORAGE_BUDGET_BYTES", "8000000000")
})
afterAll(async () => {
  await db.content.deleteMany({ where: { id: { in: contentIds } } })
  const sessions = await db.videoUploadSession.findMany({
    where: { actorId: { in: [owner, admin] } },
    select: { id: true },
  })
  const ids = sessions.map((s) => s.id)
  await db.storedVideoObject.deleteMany({ where: { sessionId: { in: ids } } })
  await db.videoStorageReservation.deleteMany({
    where: { sessionId: { in: ids } },
  })
  await db.videoUploadSession.deleteMany({ where: { id: { in: ids } } })
  await db.videoProcessorHeartbeat.deleteMany()
  await db.auditLog.deleteMany({
    where: { actorId: { in: [owner, other, admin, viewer] } },
  })
  await db.user.deleteMany({
    where: { id: { in: [owner, other, admin, viewer] } },
  })
  await db.rightsHolder.deleteMany({
    where: { id: { in: [holderId, secondHolder] } },
  })
  await db.genre.delete({ where: { id: genreId } })
  await db.language.delete({ where: { id: languageId } })
  await db.productionCompany.delete({ where: { id: companyId } })
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await db.$disconnect()
})
describe("owner workspace authorization", () => {
  it("creates and self-publishes owned catalogue content, then requires unpublishing", async () => {
    const fields = {
      ...baseFields(),
      classification: "PG",
      posterUrl: "/images/fallback-poster.svg",
      genreIds: [genreId],
      languageIds: [languageId],
      productionCompanyId: companyId,
    }
    const created = await change("content", "POST", fields)
    contentIds.push(created.id)
    await change(`content/${created.id}/publication`, "PATCH", {
      status: "PUBLISHED",
    })
    expect(
      (await db.content.findUniqueOrThrow({ where: { id: created.id } }))
        .publicationStatus
    ).toBe("PUBLISHED")
    await expect(
      change(`content/${created.id}`, "PATCH", fields)
    ).rejects.toMatchObject({ code: "UNPUBLISH_REQUIRED" })
    await change(`content/${created.id}/publication`, "PATCH", {
      status: "UNPUBLISHED",
    })
  })
  it("rejects protected fields, ownership transfer, cross-organization edits and uploads", async () => {
    const record = await title()
    await expect(
      change("content", "POST", { ...baseFields(), isPremium: true })
    ).rejects.toThrow()
    await expect(
      change(`content/${record.id}`, "PATCH", {
        ...baseFields(),
        rightsHolderId: secondHolder,
      })
    ).rejects.toMatchObject({ code: "ORGANIZATION_REQUIRED" })
    await expect(
      change(`content/${record.id}`, "PATCH", baseFields(), other)
    ).rejects.toMatchObject({ code: "CONTENT_NOT_FOUND" })
    await expect(
      createVideoUpload(other, input(record.id))
    ).rejects.toMatchObject({ code: "CONTENT_NOT_FOUND" })
    await expect(
      createVideoUpload(viewer, input(record.id))
    ).rejects.toMatchObject({ code: "CONTENT_ACCESS_REQUIRED" })
  })
  it("sanitizes owner options and filters organization sessions", async () => {
    const options = (await readCreator(
      new URL("http://localhost:3000/api/creator/options"),
      owner
    )) as { rightsHolders: { id: string }[] }
    expect(options.rightsHolders).toEqual([
      { id: holderId, name: `R2 Holder ${suffix}` },
    ])
    expect(JSON.stringify(options)).not.toContain("private@example.test")
    expect(await listVideoUploads(other)).toEqual([])
  })
})
describe("durable multipart video workflow", () => {
  it("fails before reserving unsupported-layout videos when the processor is offline", async () => {
    await db.videoProcessorHeartbeat.deleteMany()
    await expect(
      createVideoUpload(owner, {
        ...input((await title()).id),
        filename: "camera.mov",
        mediaMetadata: null,
      })
    ).rejects.toMatchObject({ code: "VIDEO_PROCESSOR_OFFLINE" })
  })
  it("queues ordinary MP4s with end metadata, then attaches their prepared output and cleans the source", async () => {
    await heartbeatVideoProcessor()
    const session = await uploaded((await title()).id)
    vi.mocked(inspectMp4Header).mockImplementationOnce(() => {
      throw new Error("metadata-at-end")
    })
    expect((await completeVideoUpload(owner, session.id)).status).toBe(
      "PROCESSING"
    )
    const current = await db.videoUploadSession.findUniqueOrThrow({
      where: { id: session.id },
    })
    await db.videoUploadSession.update({
      where: { id: session.id },
      data: { leaseToken: "worker", leaseUntil: new Date(Date.now() + 60000) },
    })
    expect((await reconcileVideoUpload(owner, session.id)).status).toBe(
      "PROCESSING"
    )
    await db.videoUploadSession.update({
      where: { id: session.id },
      data: { leaseToken: null, leaseUntil: null },
    })
    vi.mocked(prepareVideo).mockResolvedValueOnce({
      path: "prepared.mp4",
      bytes: 80,
      extension: "mp4",
      remuxed: true,
      metadata: {
        durationSeconds: 12,
        width: 320,
        height: 180,
        videoCodec: "h264",
        audioCodecs: ["aac"],
        progressive: true,
        contentType: "video/mp4",
      },
    })
    expect((await processNextVideo())?.status).toBe("COMPLETED")
    expect(objects.has(current.objectKey)).toBe(false)
    const stored = await db.storedVideoObject.findUniqueOrThrow({
      where: { sessionId: session.id },
    })
    expect(stored).toMatchObject({
      state: "READY",
      bytes: BigInt(80),
      objectKey: `ghanaverse/video/${session.id}.playback.mp4`,
    })
    expect(
      (
        await db.videoStorageReservation.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).releasedAt
    ).not.toBeNull()
  })
  it("preserves WebM playback and retries processing failures without re-uploading", async () => {
    await heartbeatVideoProcessor()
    const session = await uploaded((await title()).id, null, "recording.webm")
    expect((await completeVideoUpload(owner, session.id)).status).toBe(
      "PROCESSING"
    )
    vi.mocked(prepareVideo).mockRejectedValueOnce(
      new PlatformError(422, "INVALID_VIDEO", "Unreadable video.")
    )
    expect((await processNextVideo())?.status).toBe("PROCESSING_FAILED")
    expect((await reconcileVideoUpload(owner, session.id)).lastError).toBe(
      "Unreadable video."
    )
    expect((await completeVideoUpload(owner, session.id)).status).toBe(
      "PROCESSING"
    )
    vi.mocked(prepareVideo).mockResolvedValueOnce({
      path: "prepared.webm",
      bytes: 90,
      extension: "webm",
      remuxed: true,
      metadata: {
        durationSeconds: 12,
        width: 320,
        height: 180,
        videoCodec: "vp9",
        audioCodecs: ["opus"],
        progressive: true,
        contentType: "video/webm",
      },
    })
    expect((await processNextVideo())?.status).toBe("COMPLETED")
    expect(
      (
        await db.storedVideoObject.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).metadata
    ).toMatchObject({ videoCodec: "vp9", contentType: "video/webm" })
  })
  it("rejects preparation output that exceeds the remaining shared quota", async () => {
    await heartbeatVideoProcessor()
    const session = await uploaded((await title()).id, null, "camera.mov")
    await completeVideoUpload(owner, session.id)
    const baseline = await storageUsage()
    vi.stubEnv(
      "R2_STORAGE_BUDGET_BYTES",
      String(
        baseline.stored + baseline.reserved + baseline.pendingCleanup + 2000
      )
    )
    vi.mocked(prepareVideo).mockResolvedValueOnce({
      path: "too-large.mp4",
      bytes: 3000,
      extension: "mp4",
      remuxed: false,
      metadata: {
        durationSeconds: 12,
        width: 320,
        height: 180,
        videoCodec: "h264",
        audioCodecs: ["aac"],
        progressive: true,
        contentType: "video/mp4",
      },
    })
    expect((await processNextVideo())?.status).toBe("PROCESSING_FAILED")
    expect(
      (
        await db.videoUploadSession.findUniqueOrThrow({
          where: { id: session.id },
        })
      ).processingObjectKey
    ).toBeNull()
    expect(
      (
        await db.videoStorageReservation.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).bytes
    ).toBe(BigInt(100))
    await cancelVideoUpload(owner, session.id)
  })
  it("keeps processing output counted until source cleanup is confirmed", async () => {
    await heartbeatVideoProcessor()
    const session = await uploaded((await title()).id, null, "camera.mov")
    await completeVideoUpload(owner, session.id)
    vi.mocked(prepareVideo).mockResolvedValueOnce({
      path: "prepared.mp4",
      bytes: 75,
      extension: "mp4",
      remuxed: true,
      metadata: {
        durationSeconds: 12,
        width: 320,
        height: 180,
        videoCodec: "h264",
        audioCodecs: [],
        progressive: true,
        contentType: "video/mp4",
      },
    })
    remove.mockRejectedValueOnce(new Error("cleanup temporarily offline"))
    await processNextVideo()
    expect(
      await db.videoStorageReservation.findUniqueOrThrow({
        where: { sessionId: session.id },
      })
    ).toMatchObject({ bytes: BigInt(100), releasedAt: null })
    await cleanupVideoStorage()
    expect(
      (
        await db.videoStorageReservation.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).releasedAt
    ).not.toBeNull()
  })
  it("defers cancellation until the worker releases its lease, then removes both objects", async () => {
    await heartbeatVideoProcessor()
    const session = await uploaded((await title()).id, null, "clip.mkv")
    await completeVideoUpload(owner, session.id)
    await db.videoUploadSession.update({
      where: { id: session.id },
      data: {
        leaseToken: "worker",
        leaseUntil: new Date(Date.now() + 60000),
        processingObjectKey: `ghanaverse/video/${session.id}.playback.mp4`,
      },
    })
    expect((await cancelVideoUpload(owner, session.id)).status).toBe(
      "CANCELLING"
    )
    await db.videoUploadSession.update({
      where: { id: session.id },
      data: { leaseToken: null, leaseUntil: null },
    })
    expect((await processNextVideo())?.status).toBe("CANCELLED")
    expect(remove).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: `ghanaverse/video/${session.id}.playback.mp4`,
      })
    )
  })
  it("reserves space idempotently and signs only bounded matching parts", async () => {
    const record = await title(),
      request = input(record.id)
    const first = await createVideoUpload(owner, request),
      second = await createVideoUpload(owner, request)
    expect(first.id).toBe(second.id)
    expect(
      await db.videoStorageReservation.count({
        where: { sessionId: first.id, releasedAt: null },
      })
    ).toBe(1)
    await signVideoPart(owner, first.id, { partNumber: 1, md5: digest })
    expect(signed).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: first.id }),
      1,
      digest,
      100
    )
    await expect(
      signVideoPart(owner, first.id, { partNumber: 2, md5: digest })
    ).rejects.toMatchObject({ code: "INVALID_PART" })
    await expect(
      signVideoPart(owner, first.id, { partNumber: 1, md5: "b".repeat(32) })
    ).rejects.toMatchObject({ code: "WRONG_FILE" })
    await cancelVideoUpload(owner, first.id)
  })
  it("serializes concurrent quota reservations", async () => {
    const a = await title(),
      b = await title(),
      baseline = await storageUsage()
    vi.stubEnv(
      "R2_STORAGE_BUDGET_BYTES",
      String(
        baseline.stored + baseline.reserved + baseline.pendingCleanup + 100
      )
    )
    const result = await Promise.allSettled([
      createVideoUpload(owner, input(a.id, 75)),
      createVideoUpload(owner, input(b.id, 75)),
    ])
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(result.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "STORAGE_QUOTA_EXCEEDED" },
    })
    const success = result.find((r) => r.status === "fulfilled")
    if (success?.status === "fulfilled")
      await cancelVideoUpload(owner, success.value.id)
  })
  it("reconciles provider checksums and excludes corrupt or incomplete parts", async () => {
    const session = await uploaded((await title()).id)
    expect((await reconcileVideoUpload(owner, session.id)).parts).toEqual([
      { partNumber: 1, bytes: 100, md5: digest },
    ])
    const stored = await db.videoUploadSession.findUniqueOrThrow({
      where: { id: session.id },
    })
    parts.set(stored.objectKey, [
      { partNumber: 1, size: 99, etag: `"${digest}"` },
    ])
    expect((await reconcileVideoUpload(owner, session.id)).parts).toEqual([])
    await expect(completeVideoUpload(owner, session.id)).rejects.toMatchObject({
      code: "INVALID_PARTS",
    })
    await cancelVideoUpload(owner, session.id)
  })
  it("completes and replaces managed videos while retaining asset identity and pending cleanup", async () => {
    const record = await title(),
      first = await uploaded(record.id)
    const attached = await completeVideoUpload(owner, first.id)
    await db.videoUploadSession.update({
      where: { id: first.id },
      data: {
        leaseToken: "simulated-crash",
        leaseUntil: new Date(Date.now() + 600000),
      },
    })
    expect((await completeVideoUpload(owner, first.id)).assetId).toBe(
      attached.assetId
    )
    const asset = await db.videoAsset.findUniqueOrThrow({
      where: { id: attached.assetId! },
    })
    expect(asset).toMatchObject({
      sourceType: "MANAGED",
      playbackUrl: null,
      isPlayable: false,
    })
    await selectVideoAsset(owner, asset.id, { enabled: true })
    const second = await uploaded(record.id),
      replacement = await completeVideoUpload(owner, second.id)
    expect(replacement.assetId).toBe(asset.id)
    expect(
      (
        await db.storedVideoObject.findUniqueOrThrow({
          where: { id: asset.storedObjectId! },
        })
      ).state
    ).toBe("PENDING_DELETE")
    expect(
      (await db.videoAsset.findUniqueOrThrow({ where: { id: asset.id } }))
        .isPlayable
    ).toBe(false)
  })
  it("recovers completion when the R2 completion response is lost", async () => {
    const session = await uploaded((await title()).id)
    const implementation = complete.getMockImplementation()!
    complete.mockImplementationOnce(async (...args) => {
      await implementation(...args)
      throw new Error("simulated lost response")
    })
    await expect(completeVideoUpload(owner, session.id)).rejects.toMatchObject({
      code: "R2_OPERATION_FAILED",
    })
    expect(
      (
        await db.videoUploadSession.findUniqueOrThrow({
          where: { id: session.id },
        })
      ).status
    ).toBe("COMPLETING")
    expect((await completeVideoUpload(owner, session.id)).status).toBe(
      "COMPLETED"
    )
  })
  it("attaches episode uploads only to the correct series and disables sibling sources", async () => {
    const series = await title(true),
      foreign = await title(true)
    const season = await db.season.create({
      data: {
        seriesId: series.id,
        seasonNumber: 1,
        episodes: { create: { episodeNumber: 3, title: "Third" } },
      },
      include: { episodes: true },
    })
    const episode = season.episodes[0]
    await expect(
      createVideoUpload(owner, { ...input(foreign.id), episodeId: episode.id })
    ).rejects.toMatchObject({ code: "INVALID_DESTINATION" })
    const existing = await db.videoAsset.create({
      data: {
        episodeId: episode.id,
        sourceType: "REMOTE_URL",
        playbackUrl: "https://example.test/video.mp4",
        licenseType: "LICENSED",
        isPlayable: true,
      },
    })
    const session = await uploaded(series.id, episode.id),
      result = await completeVideoUpload(owner, session.id)
    await selectVideoAsset(owner, result.assetId!, { enabled: true })
    expect(
      (
        await db.videoAsset.findUniqueOrThrow({
          where: { id: result.assetId! },
        })
      ).episodeId
    ).toBe(episode.id)
    expect(
      (await db.videoAsset.findUniqueOrThrow({ where: { id: existing.id } }))
        .isPlayable
    ).toBe(false)
  })
  it("blocks publication and deletion during unfinished uploads", async () => {
    const record = await title(),
      session = await createVideoUpload(owner, input(record.id))
    await expect(
      change(`content/${record.id}/publication`, "PATCH", {
        status: "PUBLISHED",
      })
    ).rejects.toMatchObject({ code: "UPLOAD_IN_PROGRESS" })
    await expect(
      change(`content/${record.id}`, "DELETE", null)
    ).rejects.toMatchObject({ code: "UPLOAD_IN_PROGRESS" })
    await cancelVideoUpload(owner, session.id)
  })
  it("retains quota on failed abort/delete and releases it only after confirmed cancellation", async () => {
    const session = await createVideoUpload(owner, input((await title()).id))
    abort.mockRejectedValueOnce(new Error("network"))
    await expect(cancelVideoUpload(owner, session.id)).rejects.toMatchObject({
      code: "R2_OPERATION_FAILED",
    })
    expect(
      (
        await db.videoStorageReservation.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).releasedAt
    ).toBeNull()
    remove.mockRejectedValueOnce(new Error("network"))
    await expect(cancelVideoUpload(owner, session.id)).rejects.toMatchObject({
      code: "R2_OPERATION_FAILED",
    })
    await cancelVideoUpload(owner, session.id)
    expect(
      (
        await db.videoStorageReservation.findUniqueOrThrow({
          where: { sessionId: session.id },
        })
      ).releasedAt
    ).not.toBeNull()
    expect((await cancelVideoUpload(owner, session.id)).status).toBe(
      "CANCELLED"
    )
  })
  it("rejects expired, suspended and revoked access; cleanup can still expire sessions", async () => {
    const session = await createVideoUpload(owner, input((await title()).id))
    await db.user.update({ where: { id: owner }, data: { isSuspended: true } })
    await expect(
      signVideoPart(owner, session.id, { partNumber: 1, md5: digest })
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" })
    await db.user.update({ where: { id: owner }, data: { isSuspended: false } })
    await db.rightsHolderMembership.delete({
      where: {
        userId_rightsHolderId: { userId: owner, rightsHolderId: holderId },
      },
    })
    await expect(
      signVideoPart(owner, session.id, { partNumber: 1, md5: digest })
    ).rejects.toMatchObject({ code: "CONTENT_NOT_FOUND" })
    await db.rightsHolderMembership.create({
      data: { userId: owner, rightsHolderId: holderId },
    })
    await db.videoUploadSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    })
    await expect(reconcileVideoUpload(owner, session.id)).rejects.toMatchObject(
      { code: "UPLOAD_EXPIRED" }
    )
    await cleanupVideoStorage()
    expect(
      (
        await db.videoUploadSession.findUniqueOrThrow({
          where: { id: session.id },
        })
      ).status
    ).toBe("CANCELLED")
  })
  it("counts pending cleanup, keeps failed deletions retryable, and reconciles detached records", async () => {
    const record = await title(),
      session = await uploaded(record.id),
      result = await completeVideoUpload(owner, session.id)
    const asset = await db.videoAsset.findUniqueOrThrow({
      where: { id: result.assetId! },
    })
    await mutateAdmin(
      new URL(`http://localhost:3000/api/admin/content/${record.id}`),
      "DELETE",
      null,
      admin
    )
    expect(
      (
        await db.storedVideoObject.findUniqueOrThrow({
          where: { id: asset.storedObjectId! },
        })
      ).state
    ).toBe("PENDING_DELETE")
    remove.mockRejectedValue(new Error("network"))
    await cleanupVideoStorage()
    expect((await storageUsage()).pendingCleanup).toBeGreaterThanOrEqual(100)
    remove.mockImplementation(async (target) => {
      objects.delete(target.objectKey)
    })
    await cleanupVideoStorage()
    expect(
      (
        await db.storedVideoObject.findUniqueOrThrow({
          where: { id: asset.storedObjectId! },
        })
      ).state
    ).toBe("DELETED")
  })
})
describe("protected source authorization", () => {
  it("allows owner draft preview without analytics; denies other organizations and viewers", async () => {
    const session = await uploaded((await title()).id),
      result = await completeVideoUpload(owner, session.id)
    expect(
      await playbackSource(owner, result.assetId!, { preview: true })
    ).toMatchObject({
      kind: "native",
      url: "https://r2.invalid/authorized.mp4",
    })
    await expect(
      playbackSource(other, result.assetId!, { preview: true })
    ).rejects.toMatchObject({ code: "CONTENT_NOT_FOUND" })
    await expect(
      playbackSource(viewer, result.assetId!, { profileId })
    ).rejects.toMatchObject({ code: "VIDEO_NOT_FOUND" })
    expect(
      await db.playbackSession.count({
        where: { videoAssetId: result.assetId! },
      })
    ).toBe(0)
  })
  it("checks enabled source, publication, premium restrictions, and owned Kids profiles", async () => {
    const record = await title(),
      session = await uploaded(record.id),
      result = await completeVideoUpload(owner, session.id)
    await db.content.update({
      where: { id: record.id },
      data: { publicationStatus: "PUBLISHED" },
    })
    await expect(
      playbackSource(viewer, result.assetId!, { profileId })
    ).rejects.toMatchObject({ code: "PLAYBACK_NOT_PERMITTED" })
    await db.content.update({
      where: { id: record.id },
      data: { publicationStatus: "UNPUBLISHED" },
    })
    await selectVideoAsset(owner, result.assetId!, { enabled: true })
    await db.content.update({
      where: { id: record.id },
      data: { publicationStatus: "PUBLISHED" },
    })
    expect(
      await playbackSource(viewer, result.assetId!, { profileId })
    ).toHaveProperty("expiresAt")
    await expect(
      playbackSource(other, result.assetId!, { profileId })
    ).rejects.toMatchObject({ code: "PROFILE_REQUIRED" })
    await db.viewerProfile.update({
      where: { id: profileId },
      data: { isKids: true },
    })
    await db.content.update({
      where: { id: record.id },
      data: { classification: null },
    })
    await expect(
      playbackSource(viewer, result.assetId!, { profileId })
    ).rejects.toMatchObject({ code: "PROFILE_CONTENT_RESTRICTED" })
    await db.content.update({
      where: { id: record.id },
      data: { isPremium: true },
    })
    await expect(
      playbackSource(viewer, result.assetId!, { profileId })
    ).rejects.toMatchObject({ code: "PLAYBACK_NOT_PERMITTED" })
  })
  it("rejects unsupported codecs and enforces fixed multipart sizing", () => {
    expect(
      videoMetadataSchema.safeParse({ ...metadata, videoCodec: "hev1.1" })
        .success
    ).toBe(false)
    expect(
      videoMetadataSchema.safeParse({ ...metadata, progressive: false }).success
    ).toBe(false)
    expect(
      videoMetadataSchema.safeParse({ ...metadata, audioCodecs: ["opus"] })
        .success
    ).toBe(false)
    expect(VIDEO_PART_BYTES).toBe(16 * 1024 * 1024)
  })
})
