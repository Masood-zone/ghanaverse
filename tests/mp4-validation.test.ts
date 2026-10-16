import { afterEach, describe, expect, it, vi } from "vitest"
import { inspectMp4Header } from "@/lib/video/inspect-mp4"
import { VIDEO_HEADER_BYTES } from "@/lib/video/constants"
import { r2 } from "@/lib/r2/provider"

afterEach(() => vi.unstubAllEnvs())
describe("MP4 inspection and R2 part constraints", () => {
  it("rejects arbitrary, truncated, and oversized metadata before upload", () => {
    expect(() =>
      inspectMp4Header(
        new TextEncoder().encode("This is not an MP4 video").buffer
      )
    ).toThrow(/H.264/)
    expect(() => inspectMp4Header(new ArrayBuffer(16))).toThrow(/H.264/)
    expect(() =>
      inspectMp4Header(new ArrayBuffer(VIDEO_HEADER_BYTES + 1))
    ).toThrow(/H.264/)
  })
  it("cryptographically binds a signed part to its length and MD5", async () => {
    vi.stubEnv(
      "R2_ENDPOINT",
      `https://${"0".repeat(32)}.r2.cloudflarestorage.com`
    )
    vi.stubEnv("R2_BUCKET_NAME", "test-bucket")
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key")
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret")
    vi.stubEnv("R2_STORAGE_BUDGET_BYTES", "8000000000")
    const signed = await r2.signPart(
      {
        endpoint: process.env.R2_ENDPOINT!,
        bucket: "test-bucket",
        objectKey: "ghanaverse/video/test.mp4",
        providerUploadId: "test-upload",
      },
      1,
      "a".repeat(32),
      100
    )
    const url = new URL(signed.url)
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-length"
    )
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-md5")
    expect(url.searchParams.get("partNumber")).toBe("1")
    expect(signed.contentMD5).toBe(
      Buffer.from("a".repeat(32), "hex").toString("base64")
    )
  })
})
