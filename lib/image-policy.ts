export const APPROVED_REMOTE_IMAGE_HOSTS = new Set([
  "media.ghmoviesdb.com",
  "i.ytimg.com",
  "image.tmdb.org",
  "images.unsplash.com",
  "upload.wikimedia.org",
]);

export function safeRemoteImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && APPROVED_REMOTE_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function safeArtworkUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim();
  if (/^\/images\/[A-Za-z0-9._/-]+$/.test(normalized)) return normalized;
  return safeRemoteImageUrl(normalized);
}

export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function safePlaybackUrl(value: unknown, allowLocalDemo = false): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim();
  if (allowLocalDemo && /^\/media\/[A-Za-z0-9._/-]+$/.test(normalized)) return normalized;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch { return undefined; }
}

export function isPermittedPlaybackAsset(asset: { sourceType: string; playbackUrl: unknown; isPlayable: boolean }) {
  if (!asset.isPlayable || !["DEMO", "REMOTE_URL"].includes(asset.sourceType)) return false;
  return Boolean(safePlaybackUrl(asset.playbackUrl, asset.sourceType === "DEMO"));
}
