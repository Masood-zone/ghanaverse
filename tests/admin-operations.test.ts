import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { getPrisma } from "@/lib/prisma"
import { mutateAdmin } from "@/services/admin/operations"
import { publicContent } from "@/lib/public-content"
import { getPublishedContentBySlug } from "@/lib/catalogue"
import { publicationIssues } from "@/lib/validation/admin"

const db = getPrisma(),
  suffix = crypto.randomUUID()
const admins = [`admin-one-${suffix}`, `admin-two-${suffix}`]
const contentIds: string[] = [],
  peopleIds: string[] = [],
  collectionIds: string[] = []
let genreId: string, languageId: string, classificationName: string
const url = (path: string) => new URL(`http://localhost:3000/api/admin/${path}`)
const change = (
  path: string,
  method: string,
  body: unknown,
  actor = admins[0]
) => mutateAdmin(url(path), method, body, actor)
beforeAll(async () => {
  await db.user.createMany({
    data: admins.map((id, index) => ({
      id,
      name: `Test Admin ${index}`,
      email: `${id}@example.test`,
      role: "ADMIN" as const,
    })),
  })
  genreId = (
    await db.genre.create({
      data: { name: `Genre ${suffix}`, slug: `genre-${suffix}` },
    })
  ).id
  languageId = (
    await db.language.create({
      data: { name: `Language ${suffix}`, code: `t${suffix.slice(0, 6)}` },
    })
  ).id
  classificationName = (
    await db.classification.create({
      data: { name: `Rating ${suffix}`, slug: `rating-${suffix}` },
    })
  ).name
})
afterAll(async () => {
  await db.collection.deleteMany({ where: { id: { in: collectionIds } } })
  await db.content.deleteMany({ where: { id: { in: contentIds } } })
  await db.person.deleteMany({ where: { id: { in: peopleIds } } })
  await db.genre.deleteMany({ where: { id: genreId } })
  await db.language.deleteMany({ where: { id: languageId } })
  await db.classification.deleteMany({ where: { name: classificationName } })
  await db.auditLog.deleteMany({ where: { actorId: { in: admins } } })
  await db.user.deleteMany({ where: { id: { in: admins } } })
  await db.$disconnect()
})
describe("administrator content workflow", () => {
  it("requires a complete catalogue record before publication", () => {
    expect(
      publicationIssues({
        title: "",
        shortDescription: "",
        description: "",
        classification: null,
        posterUrl: null,
        productionCompanyId: null,
        genres: [],
        languages: [],
        credits: [],
      })
    ).toHaveLength(5)
  })
  it("creates creators, publishes catalogue-only content, enforces unpublish and filters public responses", async () => {
    const creator = await change("creators", "POST", {
      name: `Creator ${suffix}`,
    })
    peopleIds.push(creator.id)
    const input = {
      title: `Workflow ${suffix}`,
      shortDescription: "A catalogue-only title",
      description: "A real saved test record",
      contentType: "MOVIE",
      classification: classificationName,
      posterUrl: "/images/fallback-poster.svg",
      genreIds: [genreId],
      languageIds: [languageId],
      credits: [{ personId: creator.id, creditType: "CREATOR" }],
      attributionNotes: "PRIVATE RIGHTS NOTE",
    }
    const content = await change("content", "POST", input)
    contentIds.push(content.id)
    await expect(
      change(`content/${content.id}`, "PATCH", {
        ...input,
        publicationStatus: "PUBLISHED",
      })
    ).rejects.toMatchObject({ code: "USE_PUBLICATION_ACTION" })
    await change(`content/${content.id}/publication`, "PATCH", {
      status: "PUBLISHED",
    })
    await expect(
      change(`content/${content.id}`, "PATCH", input)
    ).rejects.toMatchObject({ code: "UNPUBLISH_REQUIRED" })
    await expect(
      change(`content/${content.id}/trailer`, "PUT", { video: "dQw4w9WgXcQ" })
    ).rejects.toMatchObject({ code: "UNPUBLISH_REQUIRED" })
    const saved = await db.content.findUniqueOrThrow({
      where: { id: content.id },
    })
    const published = await getPublishedContentBySlug(saved.slug)
    expect(published).not.toBeNull()
    const publicData = publicContent(published!)
    expect(publicData.credits[0].creditType).toBe("CREATOR")
    expect(publicData).not.toHaveProperty("sourcePayload")
    expect(publicData).not.toHaveProperty("videoAssets")
    expect(publicData).not.toHaveProperty("attributionNotes")
    expect(JSON.stringify(publicData)).not.toContain("PRIVATE RIGHTS NOTE")
    await change(`content/${content.id}/publication`, "PATCH", {
      status: "UNPUBLISHED",
    })
    expect(await getPublishedContentBySlug(saved.slug)).toBeNull()
    await change(`content/${content.id}`, "PATCH", {
      ...input,
      title: `Updated ${suffix}`,
    })
    expect(
      await db.auditLog.count({ where: { entityId: content.id } })
    ).toBeGreaterThanOrEqual(4)
    await expect(
      change(`creators/${creator.id}`, "DELETE", null)
    ).rejects.toMatchObject({ code: "RECORD_IN_USE" })
  })
  it("rolls back failed content writes and their audit records", async () => {
    const before = await db.auditLog.count({ where: { actorId: admins[0] } })
    await expect(
      change("content", "POST", {
        title: `Rollback ${suffix}`,
        description: "description",
        shortDescription: "short",
        contentType: "MOVIE",
        genreIds: ["missing-genre-id"],
      })
    ).rejects.toBeDefined()
    expect(
      await db.content.count({ where: { title: `Rollback ${suffix}` } })
    ).toBe(0)
    expect(await db.auditLog.count({ where: { actorId: admins[0] } })).toBe(
      before
    )
  })
  it("rejects cross-title episode assets and persists collection order", async () => {
    const first = await change("content", "POST", {
      title: `Series One ${suffix}`,
      shortDescription: "short",
      description: "description",
      contentType: "SERIES",
    })
    contentIds.push(first.id)
    const second = await change("content", "POST", {
      title: `Series Two ${suffix}`,
      shortDescription: "short",
      description: "description",
      contentType: "SERIES",
    })
    contentIds.push(second.id)
    const season = await change(`content/${first.id}/seasons`, "POST", {
      seasonNumber: 1,
    })
    const episode = await change(`seasons/${season.id}/episodes`, "POST", {
      episodeNumber: 1,
      title: "Episode One",
    })
    await expect(
      change(`content/${second.id}/video-assets`, "POST", {
        sourceType: "REMOTE_URL",
        playbackUrl: "https://example.com/video.mp4",
        licenseType: "LICENSED",
        isPlayable: true,
        episodeId: episode.id,
      })
    ).rejects.toMatchObject({ code: "EPISODE_OWNERSHIP" })
    await change(`content/${first.id}/video-assets`, "POST", {
      sourceType: "REMOTE_URL",
      playbackUrl: "https://example.com/video.mp4",
      licenseType: "LICENSED",
      isPlayable: true,
      episodeId: episode.id,
    })
    const collection = await change("collections", "POST", {
      name: `Collection ${suffix}`,
      slug: `collection-${suffix}`,
      isActive: true,
      sortOrder: 2,
      contentIds: [second.id, first.id],
    })
    collectionIds.push(collection.id)
    expect(
      (
        await db.collectionItem.findMany({
          where: { collectionId: collection.id },
          orderBy: { sortOrder: "asc" },
        })
      ).map((i) => i.contentId)
    ).toEqual([second.id, first.id])
  })
  it("protects the last active administrator during concurrent access changes", async () => {
    const results = await Promise.allSettled(
      admins.map((id) =>
        change(
          `users/${id}`,
          "PATCH",
          { role: "VIEWER", isSuspended: true },
          id
        )
      )
    )
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((r) => r.status === "rejected")
    expect(rejected?.status === "rejected" ? rejected.reason.code : null).toBe(
      "LAST_ADMIN"
    )
    expect(
      await db.user.count({
        where: { role: "ADMIN", isSuspended: false, id: { in: admins } },
      })
    ).toBe(1)
  })
})
