import { beforeEach, describe, expect, it, vi } from "vitest"
const dependencies = vi.hoisted(() => ({
  requireUserPage: vi.fn(),
  profiles: vi.fn(),
}))
vi.mock("@/lib/auth/access", () => ({
  requireUserPage: dependencies.requireUserPage,
}))
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({ viewerProfile: { findMany: dependencies.profiles } }),
}))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))
import AuthContinuationPage from "@/app/(auth)/auth/continue/page"
import { authContinuationUrl } from "@/lib/auth/callback"
beforeEach(() => {
  dependencies.requireUserPage
    .mockReset()
    .mockResolvedValue({ user: { id: "current-user" } })
  dependencies.profiles.mockReset()
})
describe("post-authentication routing", () => {
  it.each([
    { label: "zero", profiles: [] },
    { label: "one", profiles: [{ id: "one" }] },
  ])("continues directly with $label profile(s)", async ({ profiles }) => {
    dependencies.profiles.mockResolvedValue(profiles)
    await expect(
      AuthContinuationPage({
        searchParams: Promise.resolve({ callbackUrl: "/library?tab=history" }),
      })
    ).rejects.toThrow("REDIRECT:/library?tab=history")
    expect(dependencies.profiles).toHaveBeenCalledWith({
      where: { userId: "current-user" },
      select: { id: true },
      take: 2,
    })
  })
  it("opens the profile picker before the original destination for multiple profiles", async () => {
    dependencies.profiles.mockResolvedValue([{ id: "one" }, { id: "two" }])
    await expect(
      AuthContinuationPage({
        searchParams: Promise.resolve({
          callbackUrl: "/watch/video?episode=2",
        }),
      })
    ).rejects.toThrow(
      "REDIRECT:/profiles?callbackUrl=%2Fwatch%2Fvideo%3Fepisode%3D2"
    )
  })
  it.each([
    "https://outside.example",
    "//outside.example",
    "/auth/continue",
    "/api/account",
    "/%2Foutside.example",
  ])("rejects unsafe or looping callback %s", async (callbackUrl) => {
    dependencies.profiles.mockResolvedValue([{ id: "one" }])
    expect(authContinuationUrl(callbackUrl)).toBe(
      "/auth/continue?callbackUrl=%2F"
    )
    await expect(
      AuthContinuationPage({ searchParams: Promise.resolve({ callbackUrl }) })
    ).rejects.toThrow("REDIRECT:/")
    expect(dependencies.requireUserPage).toHaveBeenCalledWith("/")
  })
  it("does not fetch profiles if the session is rejected", async () => {
    dependencies.requireUserPage.mockRejectedValue(new Error("REDIRECT:/auth"))
    await expect(
      AuthContinuationPage({
        searchParams: Promise.resolve({ callbackUrl: "/account" }),
      })
    ).rejects.toThrow("REDIRECT:/auth")
    expect(dependencies.profiles).not.toHaveBeenCalled()
  })
  it("retains a direct profiles destination without nesting the picker", async () => {
    dependencies.profiles.mockResolvedValue([{ id: "one" }, { id: "two" }])
    await expect(
      AuthContinuationPage({
        searchParams: Promise.resolve({
          callbackUrl: "/profiles?callbackUrl=%2Flibrary",
        }),
      })
    ).rejects.toThrow("REDIRECT:/profiles?callbackUrl=%2Flibrary")
  })
})
