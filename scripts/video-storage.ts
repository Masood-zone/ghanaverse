import "dotenv/config"
import { r2, r2Configuration } from "../lib/r2/provider"
import { cleanupVideoStorage } from "../services/video/uploads"
import { storageUsage } from "../services/video/storage"
import { getPrisma } from "../lib/prisma"
async function main() {
  const command = process.argv[2] ?? "status"
  if (!r2Configuration().configured) {
    console.log(
      JSON.stringify(
        { ok: false, code: "R2_NOT_CONFIGURED", ...r2Configuration() },
        null,
        2
      )
    )
    process.exitCode = 1
    return
  }
  if (command === "check")
    console.log(JSON.stringify({ ok: true, ...(await r2.diagnose()) }, null, 2))
  else if (command === "cleanup")
    console.log(JSON.stringify(await cleanupVideoStorage(), null, 2))
  else if (command === "status")
    console.log(JSON.stringify(await storageUsage(), null, 2))
  else throw new Error("UNKNOWN_COMMAND")
}
main()
  .catch(() => {
    console.error(
      "R2_STORAGE_OPERATION_FAILED: Check private configuration and bucket permissions; no secrets or signed URLs are logged."
    )
    process.exitCode = 1
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await getPrisma().$disconnect()
  })
