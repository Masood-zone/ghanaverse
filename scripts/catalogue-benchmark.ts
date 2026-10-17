import "next/dist/server/node-environment.js"
import "dotenv/config"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"
import { IncrementalCache } from "next/dist/server/lib/incremental-cache/index.js"
import { nodeFs } from "next/dist/server/lib/node-fs-methods.js"
import {
  catalogueInclude,
  catalogueCardSelect,
} from "../lib/catalogue-projections"
import { unstable_cache } from "next/cache"
import { publicContent, publicContentCard } from "../lib/public-content"
import { CATALOGUE_TAG } from "../lib/catalogue-cache"

const url = process.env.TEST_DATABASE_URL
if (!url || new URL(url).searchParams.get("schema") !== "ghanaverse_test")
  throw Error("Isolated test schema required")
process.env.DATABASE_URL = url
const db = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: url },
    { schema: "ghanaverse_test" }
  ),
  log: [{ level: "query", emit: "event" }],
})
let queries = 0
db.$on("query", () => queries++)
;(globalThis as unknown as { prisma: unknown }).prisma = db
const cache = new IncrementalCache({
  dev: false,
  fs: nodeFs,
  serverDistDir: resolve("artifacts/implementation-qa/benchmark-cache"),
  flushToDisk: false,
  maxMemoryCacheSize: 20_000_000,
  requestHeaders: {},
  getPrerenderManifest: () => ({
    version: 4,
    routes: {},
    dynamicRoutes: {},
    notFoundRoutes: [],
    preview: {
      previewModeId: "benchmark",
      previewModeSigningKey: "",
      previewModeEncryptionKey: "",
    },
  }),
})
;(
  globalThis as unknown as { __incrementalCache: IncrementalCache }
).__incrementalCache = cache
const suffix = randomUUID(),
  ids: string[] = []
const output = "artifacts/implementation-qa/experience"
mkdirSync(output, { recursive: true })
async function measure(label: string, read: () => Promise<unknown>) {
  const samples: { milliseconds: number; queries: number; bytes: number }[] = []
  for (let i = 0; i < 5; i++) {
    queries = 0
    const start = performance.now()
    const result = await read()
    samples.push({
      milliseconds: Math.round((performance.now() - start) * 100) / 100,
      queries,
      bytes: Buffer.byteLength(JSON.stringify(result)),
    })
  }
  return { label, samples }
}
try {
  for (let index = 0; index < 24; index++) {
    const content = await db.content.create({
      data: {
        slug: `benchmark-${suffix}-${index}`,
        title: `Benchmark ${suffix} ${index}`,
        shortDescription: "A catalogue fixture",
        description: "Details are excluded from card payloads. ".repeat(12),
        contentType: "SERIES",
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        sourcePayload: { privateMetadata: "private".repeat(500) },
        attributionNotes: "Private rights notes",
        seasons: {
          create: {
            seasonNumber: 1,
            episodes: {
              create: Array.from({ length: 6 }, (_, episode) => ({
                episodeNumber: episode + 1,
                title: `Episode ${episode + 1}`,
                description: "Detailed episode description. ".repeat(6),
              })),
            },
          },
        },
      },
    })
    ids.push(content.id)
  }
  const query = { q: suffix, pageSize: 48, page: 1, sort: "featured" }
  const readCataloguePage = unstable_cache(
    async (query: {
      q: string
      pageSize: number
      isKids: boolean
      sample: number
    }) => {
      const where = {
        title: { contains: query.q },
        publicationStatus: "PUBLISHED" as const,
        ...(query.isKids ? { classification: { in: ["U", "PG"] } } : {}),
      }
      const [items, total] = await Promise.all([
        db.content.findMany({
          where,
          select: catalogueCardSelect,
          take: query.pageSize,
        }),
        db.content.count({ where }),
      ])
      return {
        items: items.map(publicContentCard),
        pagination: {
          page: 1,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      }
    },
    ["benchmark-catalogue"],
    { tags: [CATALOGUE_TAG], revalidate: 60 }
  )
  const legacy = await measure(
    "Before: full relations, uncached list",
    async () => {
      const [items, total] = await Promise.all([
        db.content.findMany({
          where: {
            title: { contains: suffix },
            publicationStatus: "PUBLISHED",
          },
          include: catalogueInclude,
          take: 48,
        }),
        db.content.count({
          where: {
            title: { contains: suffix },
            publicationStatus: "PUBLISHED",
          },
        }),
      ])
      return {
        items: items.map(publicContent),
        pagination: {
          page: 1,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      }
    }
  )
  let sample = 0
  const cold = await measure(
    "After: card projection, cold Next data cache",
    () => readCataloguePage({ ...query, isKids: false, sample: ++sample })
  )
  const warm = await measure(
    "After: card projection, warm Next data cache",
    () => readCataloguePage({ ...query, isKids: false, sample })
  )
  await db.content.update({
    where: { id: ids[0] },
    data: { publicationStatus: "DRAFT" },
  })
  queries = 0
  await cache.revalidateTag(CATALOGUE_TAG, { expire: 0 })
  const fresh = await readCataloguePage({ ...query, isKids: false, sample })
  const invalidation = {
    queries,
    remainingItems: fresh.items.length,
    unpublishedExcluded: !fresh.items.some((item) => item.id === ids[0]),
  }
  if (
    !invalidation.unpublishedExcluded ||
    invalidation.remainingItems !== 23 ||
    warm.samples.some((sample) => sample.queries !== 0)
  )
    throw new Error("Cache reuse or tag invalidation failed")
  const report = {
    fixture: "24 series, six episodes each, isolated local PostgreSQL",
    cache:
      "Real Next.js unstable_cache + IncrementalCache, memory-backed filesystem handler, no hosting CDN",
    legacy,
    cold,
    warm,
    invalidation,
    playbackWrites:
      "No write scheduling changes: existing 15-second coalesced saves and final pause/completion/exit saves retained. Library invalidation marks stale without an active playback refetch; read reduction is separate from writes.",
    hostingUsage:
      "Not measured; local cache results do not estimate Vercel cache billing or production latency.",
  }
  writeFileSync(`${output}/performance.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await db.content.deleteMany({ where: { id: { in: ids } } })
  await db.$disconnect()
}
