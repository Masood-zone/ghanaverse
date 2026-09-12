import "server-only";

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl?: string;
  publishedAt?: string;
};

export function extractYouTubeVideoId(input: string) {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ??
          url.pathname.match(/\/(embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[2]);
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export async function searchEmbeddableVideos(
  query: string,
): Promise<YouTubeSearchResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key)
    throw new Error(
      "YouTube trailer search is unavailable because YOUTUBE_API_KEY is not configured.",
    );
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    key,
  });
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      "YouTube trailer search failed. You can paste a video URL manually.",
    );
  const body = (await response.json()) as {
    items?: Array<{
      id: { videoId?: string };
      snippet: {
        title: string;
        channelTitle: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };
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
      : [],
  );
}
