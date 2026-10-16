const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
])
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/

export function extractYouTubeVideoId(input: string) {
  const value = input.trim()
  if (videoIdPattern.test(value)) return value
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password)
      return undefined
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.split("/")[1]
        : youtubeHosts.has(url.hostname)
          ? url.pathname === "/watch"
            ? url.searchParams.get("v")
            : url.pathname.match(
                /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/
              )?.[1]
          : undefined
    return id && videoIdPattern.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

export function resolvePlaybackSource(sourceType: string, input: unknown) {
  if (typeof input !== "string") return undefined
  const value = input.trim()
  if (sourceType === "YOUTUBE" || sourceType === "REMOTE_URL") {
    const videoId = extractYouTubeVideoId(value)
    if (videoId)
      return {
        kind: "youtube" as const,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      }
    if (sourceType === "YOUTUBE") return undefined
  }
  if (sourceType === "DEMO" && /^\/media\/[A-Za-z0-9._/-]+$/.test(value))
    return { kind: "native" as const, url: value }
  if (!["REMOTE_URL", "DEMO"].includes(sourceType)) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password)
      return undefined
    // A malformed YouTube page must never fall through to HTML video playback.
    if (youtubeHosts.has(url.hostname) || url.hostname === "youtu.be")
      return undefined
    return { kind: "native" as const, url: url.toString() }
  } catch {
    return undefined
  }
}
