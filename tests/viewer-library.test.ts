import { beforeAll, afterAll, describe, expect, it, vi } from "vitest"
vi.mock("next/headers", () => ({
  cookies: async () => new Map(),
  headers: async () => new Headers(),
}))
import { getPrisma } from "@/lib/prisma"
import { getViewerLibrary } from "@/services/viewer/operations"
const db = getPrisma(),
  suffix = crypto.randomUUID(),
  userId = `library-${suffix}`,
  otherId = `other-${suffix}`
let contentId: string, rightsId: string
beforeAll(async () => {
  await db.user.createMany({
    data: [
      { id: userId, name: "Library Test", email: `${userId}@example.test` },
      { id: otherId, name: "Other Viewer", email: `${otherId}@example.test` },
    ],
  })
  const profile = await db.viewerProfile.create({
    data: { userId, name: "Test Profile" },
  })
  rightsId = (
    await db.rightsHolder.create({
      data: {
        name: `Rights ${suffix}`,
        contactEmail: "private@example.test",
        notes: "PRIVATE CONTACT NOTES",
      },
    })
  ).id
  contentId = (
    await db.content.create({
      data: {
        title: `Library ${suffix}`,
        slug: `library-${suffix}`,
        description: "Library test record",
        shortDescription: "Library fixture",
        contentType: "MOVIE",
        publicationStatus: "PUBLISHED",
        attributionNotes: "PRIVATE ATTRIBUTION",
        sourcePayload: { internal: "PRIVATE SOURCE" },
        rightsHolderId: rightsId,
        videoAssets: {
          create: {
            sourceType: "REMOTE_URL",
            licenseType: "LICENSED",
            playbackUrl: "https://private.example/video.mp4",
            isPlayable: true,
          },
        },
      },
    })
  ).id
  await db.watchlistItem.create({ data: { profileId: profile.id, contentId } })
})
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } })
  await db.content.deleteMany({ where: { id: contentId } })
  await db.rightsHolder.deleteMany({ where: { id: rightsId } })
  await db.$disconnect()
})
describe("viewer library response", () => {
  it("returns saved titles without internal metadata, contacts or playback URLs", async () => {
    const data = await getViewerLibrary(userId)
    expect(data.watchlist).toHaveLength(1)
    const title = data.watchlist[0].content
    expect(title.videoAssets).toHaveLength(1)
    expect(title.videoAssets[0]).not.toHaveProperty("playbackUrl")
    expect(JSON.stringify(data)).not.toContain("PRIVATE")
    expect(JSON.stringify(data)).not.toContain("private@example.test")
  })
  it("isolates viewer profiles and removes unpublished titles", async () => {
    expect((await getViewerLibrary(otherId)).watchlist).toHaveLength(0)
    await db.content.update({
      where: { id: contentId },
      data: { publicationStatus: "UNPUBLISHED" },
    })
    expect((await getViewerLibrary(userId)).watchlist).toHaveLength(0)
  })
})
