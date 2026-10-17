import "dotenv/config"
import { beforeEach, vi } from "vitest"

// Match Next's JSON cache boundary in service tests; runtime cache measurements
// use the real IncrementalCache separately in scripts/catalogue-benchmark.ts.
const cache = vi.hoisted(
  () => new Map<string, { value: string; tags: string[] }>()
)
beforeEach(() => cache.clear())
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  unstable_cache:
    (
      fn: (...args: unknown[]) => Promise<unknown>,
      keys: string[] = [],
      options: { tags?: string[] } = {}
    ) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keys, fn.toString(), args])
      const prior = cache.get(key)
      if (prior) return JSON.parse(prior.value)
      const value = await fn(...args)
      const serialized = JSON.stringify(value)
      cache.set(key, { value: serialized, tags: options.tags ?? [] })
      return JSON.parse(serialized)
    },
  revalidateTag: (tag: string) => {
    for (const [key, entry] of cache)
      if (entry.tags.includes(tag)) cache.delete(key)
  },
}))
if (
  !process.env.TEST_DATABASE_URL ||
  new URL(process.env.TEST_DATABASE_URL).searchParams.get("schema") !==
    "ghanaverse_test"
)
  throw new Error(
    "Run pnpm test:prepare to configure an isolated test database"
  )
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
