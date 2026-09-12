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

export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
