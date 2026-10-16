import "server-only"
import { randomUUID } from "node:crypto"
import {
  S3Client,
  CreateMultipartUploadCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PlatformError } from "@/lib/platform-error"

export function r2Configuration() {
  const keys = [
    "R2_ENDPOINT",
    "R2_BUCKET_NAME",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ] as const
  const missing = keys.filter((key) => !process.env[key]?.trim())
  const budget = Number(process.env.R2_STORAGE_BUDGET_BYTES || "8000000000")
  let validEndpoint = false
  try {
    const url = new URL(process.env.R2_ENDPOINT || "")
    validEndpoint =
      url.protocol === "https:" &&
      /^[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(
        url.hostname
      ) &&
      !url.username &&
      !url.password &&
      !url.search &&
      url.pathname === "/"
  } catch {
    /* Report configuration status without exposing its values. */
  }
  return {
    configured:
      !missing.length &&
      validEndpoint &&
      Number.isSafeInteger(budget) &&
      budget > 0 &&
      budget <= 8_000_000_000,
    missing,
    budget:
      Number.isSafeInteger(budget) && budget > 0
        ? Math.min(budget, 8_000_000_000)
        : 8_000_000_000,
  }
}
export function r2Identity() {
  if (!r2Configuration().configured)
    throw new PlatformError(
      503,
      "R2_NOT_CONFIGURED",
      "Configure the private R2 bucket and credentials before uploading video."
    )
  return {
    endpoint: process.env.R2_ENDPOINT!.replace(/\/$/, ""),
    bucket: process.env.R2_BUCKET_NAME!,
  }
}
function provider(identity?: { endpoint: string; bucket: string }) {
  const configured = r2Identity()
  if (
    identity &&
    (identity.endpoint !== configured.endpoint ||
      identity.bucket !== configured.bucket)
  )
    throw new PlatformError(
      503,
      "R2_BUCKET_CHANGED",
      "Restore the bucket configuration used by this upload before continuing."
    )
  const client = new S3Client({
    region: "auto",
    endpoint: configured.endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 3,
    requestHandler: { requestTimeout: 60000, connectionTimeout: 10000 },
  })
  return { client, Bucket: configured.bucket }
}
type Target = { endpoint: string; bucket: string; objectKey: string }
type Multipart = Target & { providerUploadId: string }
function missing(error: unknown) {
  return (
    error instanceof Error &&
    ["NotFound", "NoSuchKey", "NoSuchUpload"].includes(error.name)
  )
}
export const r2 = {
  async initialize(target: Target, sessionId: string) {
    const { client, Bucket } = provider(target)
    const found = await client.send(
      new ListMultipartUploadsCommand({ Bucket, Prefix: target.objectKey })
    )
    const uploads = (found.Uploads ?? []).filter(
      (u) => u.Key === target.objectKey && u.UploadId
    )
    if (uploads.length > 1)
      throw new PlatformError(
        409,
        "R2_RECONCILE_REQUIRED",
        "This upload requires administrator reconciliation."
      )
    if (uploads[0]?.UploadId) return uploads[0].UploadId
    const result = await client.send(
      new CreateMultipartUploadCommand({
        Bucket,
        Key: target.objectKey,
        ContentType: "video/mp4",
        CacheControl: "private, max-age=0",
        Metadata: { "ghanaverse-session": sessionId },
      })
    )
    if (!result.UploadId) throw new Error("R2_CREATE_FAILED")
    return result.UploadId
  },
  async parts(target: Multipart) {
    const { client, Bucket } = provider(target)
    const parts: { partNumber: number; size: number; etag: string }[] = []
    let marker: string | undefined
    do {
      const result = await client.send(
        new ListPartsCommand({
          Bucket,
          Key: target.objectKey,
          UploadId: target.providerUploadId,
          PartNumberMarker: marker,
        })
      )
      for (const part of result.Parts ?? []) {
        if (!part.PartNumber || part.Size === undefined || !part.ETag)
          throw new Error("R2_INVALID_PART")
        parts.push({
          partNumber: part.PartNumber,
          size: part.Size,
          etag: part.ETag,
        })
      }
      marker = result.IsTruncated ? result.NextPartNumberMarker : undefined
    } while (marker)
    return parts.sort((a, b) => a.partNumber - b.partNumber)
  },
  async signPart(
    target: Multipart,
    partNumber: number,
    md5: string,
    bytes: number
  ) {
    const { client, Bucket } = provider(target)
    const contentMD5 = Buffer.from(md5, "hex").toString("base64")
    const url = await getSignedUrl(
      client,
      new UploadPartCommand({
        Bucket,
        Key: target.objectKey,
        UploadId: target.providerUploadId,
        PartNumber: partNumber,
        ContentMD5: contentMD5,
        ContentLength: bytes,
      }),
      {
        expiresIn: 300,
        unhoistableHeaders: new Set(["content-md5"]),
        signableHeaders: new Set(["content-md5", "content-length"]),
      }
    )
    return {
      url,
      contentMD5,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    }
  },
  async complete(
    target: Multipart,
    parts: { partNumber: number; etag: string }[]
  ) {
    const { client, Bucket } = provider(target)
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket,
        Key: target.objectKey,
        UploadId: target.providerUploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      })
    )
  },
  async head(target: Target) {
    const { client, Bucket } = provider(target)
    try {
      const value = await client.send(
        new HeadObjectCommand({ Bucket, Key: target.objectKey })
      )
      return {
        bytes: value.ContentLength,
        etag: value.ETag,
        contentType: value.ContentType,
        sessionId: value.Metadata?.["ghanaverse-session"],
      }
    } catch (error) {
      if (missing(error)) return null
      throw error
    }
  },
  async readHeader(target: Target, bytes: number) {
    const { client, Bucket } = provider(target)
    const result = await client.send(
      new GetObjectCommand({
        Bucket,
        Key: target.objectKey,
        Range: `bytes=0-${bytes - 1}`,
      })
    )
    if (!result.Body) throw new Error("R2_READ_FAILED")
    return (await result.Body.transformToByteArray()).slice().buffer
  },
  async abort(target: Target & { providerUploadId: string | null }) {
    const { client, Bucket } = provider(target)
    const ids = target.providerUploadId
      ? [target.providerUploadId]
      : ((
          await client.send(
            new ListMultipartUploadsCommand({
              Bucket,
              Prefix: target.objectKey,
            })
          )
        ).Uploads?.filter((u) => u.Key === target.objectKey)
          .map((u) => u.UploadId)
          .filter((id): id is string => Boolean(id)) ?? [])
    for (const UploadId of ids) {
      try {
        await client.send(
          new AbortMultipartUploadCommand({
            Bucket,
            Key: target.objectKey,
            UploadId,
          })
        )
      } catch (error) {
        if (!missing(error)) throw error
      }
    }
  },
  async delete(target: Target) {
    const { client, Bucket } = provider(target)
    await client.send(
      new DeleteObjectCommand({ Bucket, Key: target.objectKey })
    )
    if (await r2.head(target)) throw new Error("R2_DELETE_UNCONFIRMED")
  },
  async playback(target: Target) {
    const { client, Bucket } = provider(target)
    return {
      url: await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket, Key: target.objectKey }),
        { expiresIn: 3600 }
      ),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    }
  },
  async diagnose() {
    const { client, Bucket } = provider()
    const Key = `ghanaverse/diagnostics/${randomUUID()}.txt`
    const Body = Buffer.from("GhanaVerse R2 connection check")
    try {
      await client.send(
        new PutObjectCommand({ Bucket, Key, Body, ContentType: "text/plain" })
      )
      const result = await client.send(new GetObjectCommand({ Bucket, Key }))
      if ((await result.Body?.transformToString()) !== Body.toString())
        throw new Error("R2_READ_MISMATCH")
      const range = await client.send(
        new GetObjectCommand({ Bucket, Key, Range: "bytes=0-8" })
      )
      if ((await range.Body?.transformToString()) !== "GhanaVers")
        throw new Error("R2_RANGE_MISMATCH")
    } finally {
      await client.send(new DeleteObjectCommand({ Bucket, Key }))
    }
    if (await r2.head({ ...r2Identity(), objectKey: Key }))
      throw new Error("R2_DELETE_UNCONFIRMED")
    return {
      write: true,
      read: true,
      rangeRead: true,
      delete: true,
      browserCors: "Verify separately in the browser",
    }
  },
}

// Never log raw SDK errors: their request context can include private credentials or URLs.
export function safeR2Error(error: unknown): never {
  if (error instanceof PlatformError) throw error
  throw new PlatformError(
    502,
    "R2_OPERATION_FAILED",
    "R2 could not confirm this operation. Your reservation is retained; retry or contact an administrator."
  )
}
