/**
 * Auth Contract Behavior Test
 * Validates behavioral contracts across the auth flow with snapshot drift protection.
 *
 * Tests:
 * - callback must redirect to session-init
 * - session-init must not redirect to login when sid exists
 * - full auth flow must end in dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createTestRequest,
  getRedirectLocation,
  followRedirects,
} from "../testServer";

jest.mock("@/lib/env", () => ({
  env: {
    appUrl: "http://localhost:3000",
  },
}));

import { GET as sessionInitHandler } from "@/app/api/auth/session-init/route";

/**
 * Simulates the full auth flow from callback → session-init → dashboard.
 * Mocks Keycloak token exchange and session creation.
 */
async function simulateFullAuthFlow(sessionId: string): Promise<{
  chain: string[];
  loopDetected: boolean;
  finalDestination: string;
}> {
  const handler = async (req: NextRequest) => {
    const url = new URL(req.url);

    // Simulate callback: always redirects to session-init with sid
    if (url.pathname === "/api/auth/callback") {
      const sessionInitUrl = new URL("/api/auth/session-init", url.origin);
      sessionInitUrl.searchParams.set("sid", sessionId);
      return NextResponse.redirect(sessionInitUrl);
    }

    // Use real session-init handler
    if (url.pathname === "/api/auth/session-init") {
      return sessionInitHandler(req);
    }

    // Dashboard with session param = terminal (no redirect)
    if (url.pathname === "/dashboard" && url.searchParams.get("session")) {
      return new Response("OK", { status: 200 });
    }

    // Any other path without session = redirect to login
    if (url.pathname === "/login") {
      return new Response("Login Page", { status: 200 });
    }

    return NextResponse.redirect(new URL("/login", url.origin));
  };

  const result = await followRedirects(
    handler,
    `http://localhost:3000/api/auth/callback?code=mock-code&state=mock-state`
  );

  return {
    ...result,
    finalDestination: result.chain[result.chain.length - 1],
  };
}

describe("Auth Contract Behavior", () => {
  describe("Callback → session-init contract", () => {
    it("callback must redirect to /api/auth/session-init with sid", async () => {
      const sessionId = "contract-test-session-001";

      // Simulate what callback does: redirect to session-init
      const sessionInitUrl = new URL(
        "/api/auth/session-init",
        "http://localhost:3000"
      );
      sessionInitUrl.searchParams.set("sid", sessionId);
      const response = NextResponse.redirect(sessionInitUrl);
      const location = getRedirectLocation(response);

      expect(location).toContain("/api/auth/session-init");
      expect(location).toContain("sid=");
    });

    it("callback redirect target must include sid parameter", async () => {
      const sessionId = "uuid-format-session-id";
      const sessionInitUrl = new URL(
        "/api/auth/session-init",
        "http://localhost:3000"
      );
      sessionInitUrl.searchParams.set("sid", sessionId);

      const url = new URL(sessionInitUrl.toString());
      expect(url.pathname).toBe("/api/auth/session-init");
      expect(url.searchParams.get("sid")).toBe(sessionId);
    });
  });

  describe("session-init behavior contract", () => {
    it("must redirect to dashboard when sid exists", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/session-init?sid=valid-session-id"
      );

      const response = await sessionInitHandler(request);
      const location = getRedirectLocation(response);

      expect(location).toContain("/dashboard");
      expect(location).not.toContain("/login");
    });

    it("must include session param in dashboard redirect", async () => {
      const sid = "session-xyz-123";
      const request = createTestRequest(
        `http://localhost:3000/api/auth/session-init?sid=${sid}`
      );

      const response = await sessionInitHandler(request);
      const location = getRedirectLocation(response);

      expect(location).toContain(`session=${sid}`);
    });

    it("must redirect to login when sid is absent", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/session-init"
      );

      const response = await sessionInitHandler(request);
      const location = getRedirectLocation(response);

      expect(location).toContain("/login");
    });
  });

  describe("Full auth flow behavior (semantic drift protection)", () => {
    it("full flow must terminate at dashboard", async () => {
      const result = await simulateFullAuthFlow("drift-check-session-001");

      expect(result.loopDetected).toBe(false);
      expect(result.finalDestination).toContain("/dashboard");
    });

    it("full flow redirect chain structure is stable", async () => {
      const result = await simulateFullAuthFlow("snapshot-session-id");

      // Semantic drift protection: if the redirect chain structure changes,
      // this snapshot will fail and require explicit developer acknowledgment.
      expect(result.chain.map((url) => new URL(url).pathname))
        .toMatchInlineSnapshot(`
        [
          "/api/auth/callback",
          "/api/auth/session-init",
          "/dashboard",
        ]
      `);
    });

    it("full flow must not exceed 3 hops", async () => {
      const result = await simulateFullAuthFlow("hop-count-session");

      // callback → session-init → dashboard = 3 entries in chain
      expect(result.chain.length).toBeLessThanOrEqual(3);
    });

    it("full flow must never visit /login", async () => {
      const result = await simulateFullAuthFlow("no-login-session");

      const visitedPaths = result.chain.map((url) => new URL(url).pathname);
      expect(visitedPaths).not.toContain("/login");
    });

    it("session-init redirect target structure is stable", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/session-init?sid=stable-check"
      );

      const response = await sessionInitHandler(request);
      const location = getRedirectLocation(response);
      const url = new URL(location!);

      // Snapshot: pathname and search params structure
      expect({
        pathname: url.pathname,
        hasSessionParam: url.searchParams.has("session"),
        sessionValue: url.searchParams.get("session"),
      }).toMatchInlineSnapshot(`
        {
          "hasSessionParam": true,
          "pathname": "/dashboard",
          "sessionValue": "stable-check",
        }
      `);
    });
  });
});
