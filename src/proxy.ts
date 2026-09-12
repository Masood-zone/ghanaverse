import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/profiles", "/library", "/account", "/watch", "/admin"];

export function proxy(request: NextRequest) {
  const isProtected = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  const hasSessionCookie = request.cookies.getAll().some((cookie) => cookie.name.includes("session_token"));
  if (isProtected && !hasSessionCookie) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/profiles/:path*", "/library/:path*", "/account/:path*", "/watch/:path*", "/admin/:path*"] };
