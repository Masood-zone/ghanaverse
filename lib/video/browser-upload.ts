"use client"
import axios from "axios"
import type { VideoUploadSummary } from "@/services/video/uploads"
import type { VideoMetadata } from "@/lib/validation/video"
import { VIDEO_PART_BYTES, VIDEO_HEADER_BYTES, partBytes } from "./constants"
import { VideoRequestError, videoRequest } from "./client-api"

type Destination = {
  contentId: string
  episodeId: string | null
  label: string
  licenseType: "ORIGINAL" | "LICENSED" | "CREATIVE_COMMONS" | "PUBLIC_DOMAIN"
}
export type UploadView = VideoUploadSummary & {
  state:
    | "needs-file"
    | "checking"
    | "queued"
    | "uploading"
    | "paused"
    | "failed"
    | "complete"
  confirmedBytes: number
  transferredBytes: number
  bytesPerSecond: number
  error: string | null
}
const transfer = axios.create({ timeout: 300_000 }) // Deliberately has no application authentication interceptors.
let views: UploadView[] = []
const listeners = new Set<() => void>()
const files = new Map<string, File>()
let identity: string | null = null
let running: {
  id: string
  controller: AbortController
  done?: Promise<void>
} | null = null
let worker: Worker | undefined
const pendingHashes = new Map<
  string,
  { resolve: (hash: string) => void; reject: (error: Error) => void }
>()
export const subscribeUploads = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const uploadSnapshot = () => views
export const emptyUploads: UploadView[] = []
export const uploadsBelongTo = (userId: string) => identity === userId
export function setUploadIdentity(userId: string | null) {
  if (identity === userId) return
  running?.controller.abort()
  identity = userId
  files.clear()
  views = []
  emit()
}
function emit() {
  for (const listener of listeners) listener()
}
function update(id: string, changes: Partial<UploadView>) {
  views = views.map((v) => (v.id === id ? { ...v, ...changes } : v))
  emit()
}
function hashPart(blob: Blob): Promise<string> {
  worker ??= new Worker(new URL("./hash.worker.ts", import.meta.url), {
    type: "module",
  })
  worker.onmessage = (
    event: MessageEvent<{ id: string; md5?: string; error?: string }>
  ) => {
    const request = pendingHashes.get(event.data.id)
    pendingHashes.delete(event.data.id)
    if (event.data.md5) request?.resolve(event.data.md5)
    else
      request?.reject(new Error(event.data.error ?? "Integrity check failed."))
  }
  worker.onerror = () => {
    for (const request of pendingHashes.values())
      request.reject(new Error("File integrity worker failed."))
    pendingHashes.clear()
    worker?.terminate()
    worker = undefined
  }
  return blob.arrayBuffer().then(
    (bytes) =>
      new Promise<string>((resolve, reject) => {
        const id = crypto.randomUUID()
        pendingHashes.set(id, { resolve, reject })
        worker!.postMessage({ id, bytes }, [bytes])
      })
  )
}
async function fingerprint(file: File) {
  const bytes = await new Blob([
    `${file.name}:${file.size}:${file.lastModified}:`,
    file.slice(0, 1024 * 1024),
    file.slice(Math.max(0, file.size - 1024 * 1024)),
  ]).arrayBuffer()
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0")
  ).join("")
}
function abortCheck(signal: AbortSignal) {
  signal.throwIfAborted()
  if (!navigator.onLine)
    throw new Error("You are offline. Resume when your connection returns.")
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException("Paused", "AbortError"))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, ms)
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
  })
}
export async function recoverUploads() {
  const sessions = await videoRequest<VideoUploadSummary[]>("video-uploads")
  for (const session of sessions) {
    if (!views.some((v) => v.id === session.id))
      views = [
        ...views,
        {
          ...session,
          state: "needs-file",
          confirmedBytes: 0,
          transferredBytes: 0,
          bytesPerSecond: 0,
          error: null,
        },
      ]
  }
  emit()
}
export async function queueVideo(file: File, destination: Destination) {
  if (!/\.mp4$/i.test(file.name) || !file.size)
    throw new Error("Choose a prepared MP4 file.")
  const { inspectMp4Header } = await import("./inspect-mp4")
  const mediaMetadata: VideoMetadata = inspectMp4Header(
    await file.slice(0, VIDEO_HEADER_BYTES).arrayBuffer()
  )
  const identity = await fingerprint(file)
  // Persist the idempotency key before a request whose response can be lost.
  const key = `ghanaverse.video.v1:${destination.contentId}:${destination.episodeId ?? "movie"}:${identity}`
  let idempotencyKey = localStorage.getItem(key)
  if (!idempotencyKey) {
    idempotencyKey = crypto.randomUUID()
    localStorage.setItem(key, idempotencyKey)
  }
  const session = await videoRequest<VideoUploadSummary>(
    "video-uploads",
    "POST",
    {
      idempotencyKey,
      contentId: destination.contentId,
      episodeId: destination.episodeId,
      filename: file.name,
      fileSize: file.size,
      lastModified: file.lastModified,
      fingerprint: identity,
      licenseType: destination.licenseType,
      mediaMetadata,
    }
  )
  if (session.status === "CANCELLED") {
    localStorage.removeItem(key)
    throw new Error(
      "The previous upload was cancelled. Select the file again to start a new session."
    )
  }
  localStorage.setItem(
    `ghanaverse.video.session.v1:${session.id}`,
    JSON.stringify({
      id: session.id,
      storageKey: key,
      filename: session.filename,
      fileSize: session.fileSize,
      fingerprint: identity,
    })
  )
  files.set(session.id, file)
  views = [
    ...views.filter((v) => v.id !== session.id),
    {
      ...session,
      state: session.status === "COMPLETED" ? "complete" : "queued",
      confirmedBytes: session.status === "COMPLETED" ? session.fileSize : 0,
      transferredBytes: 0,
      bytesPerSecond: 0,
      error: null,
    },
  ]
  emit()
  pump()
}
export async function resumeVideo(id: string, selected?: File) {
  const view = views.find((v) => v.id === id)
  if (!view) return
  const file = selected ?? files.get(id)
  if (!file) throw new Error("Reselect the original file to resume.")
  update(id, { state: "checking", error: null })
  if (
    file.size !== view.fileSize ||
    file.name !== view.filename ||
    file.lastModified !== view.lastModified ||
    (await fingerprint(file)) !== view.fingerprint
  ) {
    update(id, {
      state: "needs-file",
      error:
        "This is a different file. Select the original file, with its original name and modified date.",
    })
    throw new Error("The selected file does not match the original upload.")
  }
  files.set(id, file)
  update(id, { state: "queued", error: null })
  pump()
}
export function pauseVideo(id: string) {
  if (running?.id === id) running.controller.abort()
  update(id, { state: "paused", bytesPerSecond: 0 })
}
export async function cancelVideo(id: string) {
  pauseVideo(id)
  if (running?.id === id) await running.done
  try {
    const result = await videoRequest<VideoUploadSummary>(
      `video-uploads/${id}`,
      "DELETE"
    )
    if (result.status === "COMPLETED") {
      update(id, {
        state: "complete",
        status: "COMPLETED",
        confirmedBytes: result.fileSize,
        transferredBytes: result.fileSize,
        error:
          "This upload finished before cancellation. Remove its video from the editor if it is no longer needed.",
      })
      files.delete(id)
      return
    }
    try {
      const saved = JSON.parse(
        localStorage.getItem(`ghanaverse.video.session.v1:${id}`) ?? "null"
      ) as { storageKey?: string } | null
      if (saved?.storageKey?.startsWith("ghanaverse.video.v1:"))
        localStorage.removeItem(saved.storageKey)
    } catch {
      /* A damaged browser hint must not prevent server-confirmed cancellation. */
    }
    files.delete(id)
    localStorage.removeItem(`ghanaverse.video.session.v1:${id}`)
    views = views.filter((v) => v.id !== id)
    emit()
  } catch (error) {
    update(id, {
      state: "failed",
      error:
        error instanceof Error
          ? error.message
          : "Cancellation failed. Storage remains reserved.",
    })
    throw error
  }
}
export function dismissVideo(id: string) {
  views = views.filter((v) => v.id !== id)
  files.delete(id)
  localStorage.removeItem(`ghanaverse.video.session.v1:${id}`)
  emit()
}
function pump() {
  if (running) return
  const next = views.find((v) => v.state === "queued" && files.has(v.id))
  if (!next) return
  const active = {
    id: next.id,
    controller: new AbortController(),
    done: undefined as Promise<void> | undefined,
  }
  running = active
  active.done = run(next, files.get(next.id)!, active.controller)
    .catch((error: unknown) => {
      const paused =
        (active.controller.signal.aborted &&
          active.controller.signal.reason instanceof DOMException &&
          active.controller.signal.reason.name === "AbortError") ||
        !navigator.onLine ||
        (error instanceof VideoRequestError && error.status === 401)
      update(next.id, {
        state: paused ? "paused" : "failed",
        bytesPerSecond: 0,
        error: paused
          ? !navigator.onLine
            ? "Offline. Reconnect, then resume."
            : error instanceof VideoRequestError && error.status === 401
              ? "Sign in again, then resume this upload."
              : null
          : error instanceof Error
            ? error.message
            : "Upload failed. Retry to preserve completed parts.",
      })
    })
    .finally(() => {
      running = null
      pump()
    })
}
async function run(view: UploadView, file: File, controller: AbortController) {
  if (!navigator.locks)
    throw new Error(
      "This browser cannot coordinate uploads across tabs. Use a current browser over HTTPS or localhost."
    )
  await navigator.locks.request(
    "ghanaverse.video.queue.v1",
    { ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new Error(
          "Another browser tab is uploading. Pause it before resuming here."
        )
      const signal = controller.signal
      abortCheck(signal)
      update(view.id, { state: "checking", error: null })
      if (view.status === "COMPLETING") {
        await videoRequest(`video-uploads/${view.id}/complete`, "POST", {})
        finish(view)
        return
      }
      const state = await videoRequest<
        VideoUploadSummary & {
          parts: { partNumber: number; md5: string; bytes: number }[]
        }
      >(`video-uploads/${view.id}`, "GET", undefined, signal)
      if (state.status === "COMPLETED") {
        finish(view)
        return
      }
      const completed = new Set<number>()
      let confirmed = 0
      for (const part of state.parts) {
        abortCheck(signal)
        const start = (part.partNumber - 1) * VIDEO_PART_BYTES
        if (
          (await hashPart(file.slice(start, start + part.bytes))) !== part.md5
        )
          throw new Error(
            "The reselected file differs from an uploaded part. Choose the original file."
          )
        completed.add(part.partNumber)
        confirmed += part.bytes
        update(view.id, {
          confirmedBytes: confirmed,
          transferredBytes: confirmed,
        })
      }
      const todo = Array.from(
        { length: Math.ceil(file.size / VIDEO_PART_BYTES) },
        (_, i) => i + 1
      ).filter((n) => !completed.has(n))
      const inflight = new Map<number, number>(),
        started = performance.now(),
        initial = confirmed
      const progress = () =>
        update(view.id, {
          confirmedBytes: confirmed,
          transferredBytes: Math.min(
            file.size,
            confirmed + [...inflight.values()].reduce((a, b) => a + b, 0)
          ),
          bytesPerSecond: Math.max(
            0,
            (confirmed - initial) / ((performance.now() - started) / 1000 || 1)
          ),
        })
      update(view.id, {
        state: "uploading",
        confirmedBytes: confirmed,
        transferredBytes: confirmed,
      })
      let cursor = 0
      const upload = async () => {
        while (cursor < todo.length) {
          abortCheck(signal)
          const number = todo[cursor++],
            start = (number - 1) * VIDEO_PART_BYTES
          const slice = file.slice(start, start + partBytes(file.size, number)),
            md5 = await hashPart(slice)
          for (let attempt = 0; ; attempt++) {
            abortCheck(signal)
            try {
              const signed = await videoRequest<{
                url: string
                contentMD5: string
              }>(
                `video-uploads/${view.id}/parts`,
                "POST",
                { partNumber: number, md5 },
                signal
              )
              const result = await transfer.put(signed.url, slice, {
                signal,
                headers: {
                  "Content-Type": "application/octet-stream",
                  "Content-MD5": signed.contentMD5,
                },
                onUploadProgress: (event) => {
                  inflight.set(number, event.loaded)
                  progress()
                },
              })
              if (
                String(result.headers.etag ?? "")
                  .replaceAll('"', "")
                  .toLowerCase() !== md5
              )
                throw new Error(
                  "R2 did not expose a matching ETag. Check bucket CORS before retrying."
                )
              confirmed += slice.size
              inflight.delete(number)
              progress()
              break
            } catch (error) {
              inflight.delete(number)
              if (
                signal.aborted ||
                !navigator.onLine ||
                (error instanceof VideoRequestError &&
                  [400, 401, 403, 409, 410, 422, 503].includes(error.status))
              )
                throw error
              if (attempt >= 5)
                throw new Error(
                  "A part failed after five retries. Retry this upload to retain confirmed parts. Check the connection and bucket CORS."
                )
              await delay(
                Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500,
                signal
              )
            }
          }
        }
      }
      const jobs = Array.from({ length: Math.min(3, todo.length) }, () =>
        upload().catch((error) => {
          controller.abort(error)
          throw error
        })
      )
      const results = await Promise.allSettled(jobs)
      const failed = results.find(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      )
      if (failed) throw failed.reason
      abortCheck(signal)
      update(view.id, { status: "COMPLETING", state: "checking" })
      await videoRequest(`video-uploads/${view.id}/complete`, "POST", {})
      finish(view)
    }
  )
}
function finish(view: UploadView) {
  update(view.id, {
    state: "complete",
    status: "COMPLETED",
    confirmedBytes: view.fileSize,
    transferredBytes: view.fileSize,
    bytesPerSecond: 0,
    error: null,
  })
  files.delete(view.id)
  window.dispatchEvent(new Event("ghanaverse:video-upload-complete"))
}
