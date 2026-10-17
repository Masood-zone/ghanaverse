import "dotenv/config"
import { setTimeout as wait } from "node:timers/promises"
import { getPrisma } from "../lib/prisma"
import { processNotificationBatch } from "../services/notifications/worker"
const controller = new AbortController()
process.once("SIGINT", () => controller.abort())
process.once("SIGTERM", () => controller.abort())
async function main() {
  if (process.env.NOTIFICATION_WORKER_ENABLED !== "true")
    throw new Error("NOTIFICATION_WORKER_DISABLED")
  console.log(
    "GhanaVerse notification worker ready. Provider acceptance is recorded separately from delivery."
  )
  do {
    const count = await processNotificationBatch(4)
    if (count) console.log(`Processed ${count} notification(s).`)
    if (process.argv.includes("--once")) break
    if (!count) await wait(5000, undefined, { signal: controller.signal })
  } while (!controller.signal.aborted)
}
main()
  .catch(() => {
    if (!controller.signal.aborted) {
      console.error(
        "NOTIFICATION_WORKER_FAILED: Check database migration and provider configuration. Inspect /admin/notifications."
      )
      process.exitCode = 1
    }
  })
  .finally(async () => {
    await getPrisma().$disconnect()
  })
