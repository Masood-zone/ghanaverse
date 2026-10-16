import "server-only"
export { extractYouTubeVideoId } from "@/lib/playback-source"

export type YouTubeSearchResult = {
  videoId: string
  title: string
  channel: string
  thumbnailUrl?: string
  publishedAt?: string
}

export async function searchEmbeddableVideos(
  query: string
): Promise<YouTubeSearchResult[]> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key)
    throw new Error(
      "YouTube trailer search is unavailable because YOUTUBE_API_KEY is not configured."
    )
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    key,
  })
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { cache: "no-store" }
  )
  if (!response.ok)
    throw new Error(
      "YouTube trailer search failed. You can paste a video URL manually."
    )
  const body = (await response.json()) as {
    items?: Array<{
      id: { videoId?: string }
      snippet: {
        title: string
        channelTitle: string
        publishedAt?: string
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
      }
    }>
  }
  return (body.items ?? []).flatMap((item) =>
    item.id.videoId
      ? [
          {
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnailUrl:
              item.snippet.thumbnails?.medium?.url ??
              item.snippet.thumbnails?.default?.url,
            publishedAt: item.snippet.publishedAt,
          },
        ]
      : []
  )
}
