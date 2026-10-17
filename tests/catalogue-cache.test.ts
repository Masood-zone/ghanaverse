import { afterAll, describe, expect, it, vi } from "vitest"
import { getPrisma } from "@/lib/prisma"
import {
  catalogueQuerySchema,
  readCataloguePage,
  getCatalogueFacets,
} from "@/lib/catalogue"
import { invalidateCatalogue } from "@/lib/catalogue-cache"
const db = getPrisma(),
  ids: string[] = []
afterAll(async () => {
  await db.content.deleteMany({ where: { id: { in: ids } } })
})
describe("catalogue caching boundaries", () => {
  it("reuses shared cards, partitions Kids/pagination/filter keys and expires after mutations", async () => {
    const suffix = crypto.randomUUID()
    const rows = await db.content.createManyAndReturn({
      data: ["U", "18"].map((classification) => ({
        title: `Cache ${suffix} ${classification}`,
        slug: `cache-${suffix}-${classification}`,
        shortDescription: "Fixture",
        description: "Private detail",
        contentType: "MOVIE" as const,
        publicationStatus: "PUBLISHED" as const,
        classification: null,
      })),
    })
    ids.push(...rows.map((row) => row.id))
    const read = vi.spyOn(db.content, "findMany")
    try {
      const query = catalogueQuerySchema.parse({ q: suffix })
      const first = await readCataloguePage(query, false)
      await readCataloguePage(query, false)
      expect(read).toHaveBeenCalledTimes(1)
      expect(first.items[0]).not.toHaveProperty("seasons")
      expect(first.items[0]).not.toHaveProperty("description")
      expect(first.items[0]).not.toHaveProperty("videoAssets")
      expect(first.items[0]).not.toHaveProperty("sourcePayload")
      const kids = await readCataloguePage(query, true)
      expect(kids.items).toEqual([]) // Unclassified records are excluded for Kids.
      await readCataloguePage({ ...query, page: 2 }, false)
      await readCataloguePage({ ...query, q: "different" }, false)
      expect(read).toHaveBeenCalledTimes(4)
      await db.content.update({
        where: { id: rows[0].id },
        data: { publicationStatus: "DRAFT" },
      })
      await invalidateCatalogue()
      const fresh = await readCataloguePage(query, false)
      expect(fresh.items.map((item) => item.id)).not.toContain(rows[0].id)
      expect(read).toHaveBeenCalledTimes(5)
    } finally {
      read.mockRestore()
    }
  })
  it("caches reference data independently and invalidates metadata tags", async () => {
    const read = vi.spyOn(db.genre, "findMany")
    try {
      await getCatalogueFacets()
      await getCatalogueFacets()
      expect(read).toHaveBeenCalledTimes(1)
      await invalidateCatalogue("metadata")
      await getCatalogueFacets()
      expect(read).toHaveBeenCalledTimes(2)
    } finally {
      read.mockRestore()
    }
  })
})
