import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("protected route proxy", () => {
  it("redirects an unauthenticated viewer route to auth", () => {
    const response = proxy(new NextRequest("http://localhost:3000/library"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/auth?callbackUrl=%2Flibrary");
  });

  it("allows a session-shaped request to reach the authoritative server guard", () => {
    const request = new NextRequest("http://localhost:3000/admin", { headers: { cookie: "better-auth.session_token=test" } });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });
});
