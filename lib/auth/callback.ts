const callbackOrigin = "https://ghanaverse.invalid"
export type PageSearchParams = Record<string, string | string[] | undefined>

export function authContinuationUrl(callbackUrl: string) {
  return `/auth/continue?callbackUrl=${encodeURIComponent(safeCallbackUrl(callbackUrl))}`
}

export function safeCallbackUrl(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/"
  try {
    const url = new URL(value, callbackOrigin)
    const decodedPath = decodeURIComponent(url.pathname)
    if (
      url.origin !== callbackOrigin ||
      decodedPath.startsWith("//") ||
      /[\\\u0000-\u0020]/.test(decodedPath) ||
      /^\/auth(?:\/|$)/i.test(decodedPath) ||
      /^\/api(?:\/|$)/i.test(decodedPath)
    )
      return "/"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/"
  }
}

export function profilePickerUrl(callbackUrl: string) {
  const destination = safeCallbackUrl(callbackUrl)
  return /^\/profiles(?:[/?#]|$)/.test(destination)
    ? destination
    : `/profiles?callbackUrl=${encodeURIComponent(destination)}`
}

export function callbackWithSearch(
  pathname: string,
  searchParams: PageSearchParams
) {
  const url = new URL(safeCallbackUrl(pathname), callbackOrigin)
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      url.searchParams.append(key, item)
  }
  return safeCallbackUrl(`${url.pathname}${url.search}`)
}
