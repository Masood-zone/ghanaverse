import "server-only"
import { requireAdmin, requireUser } from "@/lib/auth/access"
import { assertRequestOrigin } from "@/services/content/access"
import { apiSuccess } from "@/lib/api-response"
import { PlatformError, routeError } from "@/lib/route-error"
import { r2, r2Configuration, safeR2Error } from "@/lib/r2/provider"
import { getPrisma } from "@/lib/prisma"
import { storageUsage } from "./storage"
import {
  createVideoUpload,
  listVideoUploads,
  reconcileVideoUpload,
  signVideoPart,
  completeVideoUpload,
  cancelVideoUpload,
  cleanupVideoStorage,
} from "./uploads"
import { playbackSource, selectVideoAsset } from "./playback"
export async function handleVideo(request: Request) {
  try {
    const { user } = await requireUser()
    const parts = new URL(request.url).pathname.split("/").filter(Boolean)
    const id = parts[2],
      action = parts[3]
    if (request.method !== "GET") assertRequestOrigin(request)
    let result: unknown
    if (parts[1] === "video-uploads") {
      if (request.method === "GET")
        result = id
          ? await reconcileVideoUpload(user.id, id)
          : await listVideoUploads(user.id)
      else if (request.method === "DELETE" && id)
        result = await cancelVideoUpload(user.id, id)
      else if (request.method === "POST" && !id)
        result = await createVideoUpload(user.id, await request.json())
      else if (request.method === "POST" && action === "parts")
        result = await signVideoPart(user.id, id, await request.json())
      else if (request.method === "POST" && action === "complete")
        result = await completeVideoUpload(user.id, id)
      else
        throw new PlatformError(
          405,
          "METHOD_NOT_ALLOWED",
          "Unsupported upload operation."
        )
    } else if (parts[1] === "playback")
      result = await playbackSource(user.id, parts[3], await request.json())
    else if (parts[1] === "video-assets")
      result = await selectVideoAsset(user.id, id, await request.json())
    else if (parts[1] === "admin" && id === "storage") {
      await requireAdmin()
      if (request.method === "POST") {
        if (action === "diagnostics") {
          try {
            result = await r2.diagnose()
          } catch (error) {
            return safeR2Error(error)
          }
        } else if (action === "cleanup") result = await cleanupVideoStorage()
        else
          throw new PlatformError(404, "NOT_FOUND", "Unknown storage action.")
      } else {
        const db = getPrisma()
        const [usage, sessions, objects] = await Promise.all([
          storageUsage(),
          db.videoUploadSession.findMany({
            where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              destination: true,
              filename: true,
              fileSize: true,
              status: true,
              lastError: true,
              expiresAt: true,
            },
          }),
          db.storedVideoObject.findMany({
            where: { state: { not: "DELETED" } },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              bytes: true,
              state: true,
              lastError: true,
              asset: { select: { id: true } },
            },
          }),
        ])
        result = {
          configuration: r2Configuration(),
          usage,
          sessions: sessions.map((s) => ({
            ...s,
            fileSize: Number(s.fileSize),
          })),
          objects: objects.map((o) => ({ ...o, bytes: Number(o.bytes) })),
        }
      }
    } else throw new PlatformError(404, "NOT_FOUND", "Unknown video operation.")
    const response = apiSuccess(result)
    response.headers.set("Cache-Control", "private, no-store")
    return response
  } catch (error) {
    return routeError(error)
  }
}
