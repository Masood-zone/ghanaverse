import { describe, expect, it } from "vitest"
import { PlaybackTracker } from "@/lib/player-tracking"
import { ProgressQueue } from "@/lib/progress-queue"
import {
  coverageSeconds,
  mergeCoverage,
  minutesToSeconds,
} from "@/lib/playback-metrics"
import {
  extractYouTubeVideoId,
  resolvePlaybackSource,
} from "@/lib/playback-source"
const state = (position: number, playing = true, visible = true, rate = 1) => ({
  position,
  playing,
  visible,
  rate,
  duration: 100,
})
describe("playback sources and durations", () => {
  it("recognizes YouTube links and legacy remote links without accepting lookalike hosts", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=8",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    ])
      expect(resolvePlaybackSource("REMOTE_URL", url)?.kind).toBe("youtube")
    expect(
      extractYouTubeVideoId("https://evil.test/watch?v=dQw4w9WgXcQ")
    ).toBeUndefined()
    expect(
      extractYouTubeVideoId("https://youtube.com.evil.test/embed/dQw4w9WgXcQ")
    ).toBeUndefined()
    expect(
      resolvePlaybackSource("REMOTE_URL", "https://youtube.com/watch?v=bad")
    ).toBeUndefined()
    expect(
      resolvePlaybackSource("YOUTUBE", "https://evil.test/video.mp4")
    ).toBeUndefined()
    expect(
      resolvePlaybackSource("REMOTE_URL", "https://cdn.example.test/video.mp4")
        ?.kind
    ).toBe("native")
    expect(resolvePlaybackSource("DEMO", "/media/demo.mp4")?.kind).toBe(
      "native"
    )
    expect(
      resolvePlaybackSource("REMOTE_URL", "/media/demo.mp4")
    ).toBeUndefined()
  })
  it("converts minutes once, retaining blank values and fractions", () => {
    expect(minutesToSeconds(37)).toBe(2220)
    expect(minutesToSeconds("37.5")).toBe(2250)
    expect(minutesToSeconds(0.5)).toBe(30)
    expect(minutesToSeconds("")).toBeNull()
    expect(minutesToSeconds(null)).toBeNull()
  })
})
describe("active viewing measurement", () => {
  it("credits the final short interval on pause but excludes explicit seek intervals", () => {
    const tracker = new PlaybackTracker()
    tracker.observe(state(0), 0)
    tracker.observe(state(0.5, false), 500)
    expect(tracker.watchedMilliseconds).toBe(500)
    tracker.observe(state(0.5), 600)
    tracker.observe({ ...state(1, false), seeking: true }, 1100)
    expect(tracker.watchedMilliseconds).toBe(500)
  })
  it("excludes pause, buffering, hidden time and seeking while including replay", () => {
    const tracker = new PlaybackTracker()
    tracker.observe(state(0), 0)
    tracker.observe(state(1), 1000)
    tracker.observe(state(1, false), 2000)
    tracker.observe(state(1, false), 10000)
    tracker.observe(state(1), 11000)
    tracker.observe(state(2), 12000)
    tracker.observe(state(80), 13000)
    tracker.observe(state(81, true, false), 14000)
    tracker.observe(state(82, true, false), 15000)
    tracker.observe(state(82), 16000)
    tracker.observe(state(0), 17000)
    tracker.observe(state(1), 18000)
    expect(tracker.watchedMilliseconds).toBe(3000)
    expect(coverageSeconds(tracker.coverage)).toBe(2)
  })
  it("counts wall time rather than timeline distance at increased speed", () => {
    const tracker = new PlaybackTracker()
    tracker.observe(state(0, true, true, 2), 0)
    tracker.observe(state(2, true, true, 2), 1000)
    expect(tracker.watchedMilliseconds).toBe(1000)
    expect(coverageSeconds(tracker.coverage)).toBe(2)
  })
  it("merges overlapping watched ranges rather than counting repeated coverage", () => {
    expect(
      mergeCoverage(
        [
          [0, 10],
          [5, 15],
          [20, 200],
        ],
        100
      )
    ).toEqual([
      [0, 15],
      [20, 100],
    ])
    expect(
      coverageSeconds(
        mergeCoverage(
          [
            [0, 10],
            [0, 10],
          ],
          100
        )
      )
    ).toBe(10)
  })
})
describe("progress save queue", () => {
  it("serializes requests, coalesces queued snapshots and skips unchanged saves", async () => {
    const sent: number[] = [],
      resolvers: (() => void)[] = []
    const queue = new ProgressQueue<number>((value) => {
      sent.push(value)
      return new Promise<void>((resolve) => resolvers.push(resolve))
    }, String)
    const first = queue.enqueue(1)
    void queue.enqueue(2)
    void queue.enqueue(3)
    expect(sent).toEqual([1])
    resolvers.shift()!()
    await Promise.resolve()
    expect(sent).toEqual([1, 3])
    resolvers.shift()!()
    await first
    await queue.enqueue(3)
    expect(sent).toEqual([1, 3])
  })
  it("retains failed work for the next retry and sends the latest cumulative snapshot", async () => {
    const sent: number[] = []
    const queue = new ProgressQueue<number>(async (value) => {
      sent.push(value)
      if (sent.length === 1) throw new Error("Network unavailable")
    }, String)
    await expect(queue.enqueue(1)).rejects.toThrow("Network unavailable")
    await queue.enqueue(2)
    expect(sent).toEqual([1, 2])
  })
})
