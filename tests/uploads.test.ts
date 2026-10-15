import { describe, expect, it } from "vitest"
import { uploadArtwork } from "@/lib/cloudinary/cloudinary-service"
describe("artwork upload validation", () => {
  it("rejects unsupported purposes and MIME types before a provider call", async () => {
    await expect(
      uploadArtwork(
        new File(["content"], "file.pdf", { type: "application/pdf" }),
        "poster"
      )
    ).rejects.toMatchObject({ code: "INVALID_FILE" })
    await expect(
      uploadArtwork(
        new File(["content"], "image.png", { type: "image/png" }),
        "arbitrary-folder"
      )
    ).rejects.toBeDefined()
  })
  it("rejects image contents that disagree with the declared supported format", async () => {
    await expect(
      uploadArtwork(
        new File(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
          ],
          "spoof.png",
          { type: "image/png" }
        ),
        "poster"
      )
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" })
  })
})
