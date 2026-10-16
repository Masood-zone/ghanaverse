export class VideoRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message)
  }
}
export async function videoRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  const value = await response.json()
  if (!response.ok || !value.success)
    throw new VideoRequestError(
      value.message ?? "Video request failed.",
      response.status,
      value.code ?? "REQUEST_FAILED"
    )
  return value.data as T
}
