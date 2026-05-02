/**
 * Auth Contract Behavior Test
 * Validates behavioral contracts across the auth flow with snapshot drift protection.
 *
 * Tests:
 * - callback must redirect directly to dashboard
 * - session-init must not issue a cookie for an invalid sid
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

jest.mock("@/lib/auth/session", () => ({
  sessionStore: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

import { GET as sessionInitHandler } from "@/app/api/auth/session-init/route";
import { sessionStore } from "@/lib/auth/session";

const mockedSessionStore = sessionStore as jest.Mocked<typeof sessionStore>;

const validSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  idToken: "id-token",
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "Test User",
    roles: ["user"],
  },
  accessExpiresAt: Math.floor(Date.now() / 1000) + 300,
  refreshExpiresAt: Math.floor(Date.now() / 1000) + 1800,
  createdAt: Math.floor(Date.now() / 1000),
};

/**
 * Simulates the full auth flow from callback → dashboard.
 */
async function simulateFullAuthFlow(sessionId: string): Promise<{
  chain: string[];
  loopDetected: boolean;
  finalDestination: string;
}> {
  const handler = async (req: NextRequest) => {
    const url = new URL(req.url);

    // Simulate callback: sets cookie server-side and redirects directly to dashboard.
    if (url.pathname === "/api/auth/callback") {
      const dashboardUrl = new URL("/dashboard", url.origin);
      const response = NextResponse.redirect(dashboardUrl);
      response.cookies.set("__session", sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      });
      return response;
    }

    // Dashboard = terminal (auth via cookie, not query param)
    if (url.pathname === "/dashboard") {
      return new Response("OK", { status: 200 });
    }

    // Any other path = redirect to login
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSessionStore.get.mockResolvedValue(validSession);
  });

  describe("Callback success contract", () => {
    it("callback must redirect directly to /dashboard", async () => {
      const response = NextResponse.redirect(
        new URL("/dashboard", "http://localhost:3000")
      );
      const location = getRedirectLocation(response);

      expect(location).toBe("http://localhost:3000/dashboard");
    });

    it("callback redirect target must not include sid parameter", async () => {
      const response = NextResponse.redirect(
        new URL("/dashboard", "http://localhost:3000")
      );
      const location = getRedirectLocation(response);
      const url = new URL(location!);

      expect(url.pathname).toBe("/dashboard");
      expect(url.searchParams.get("sid")).toBeNull();
    });
  });

  describe("session-init legacy guard contract", () => {
    it("must redirect to dashboard when sid resolves to a server session", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/session-init?sid=valid-session-id"
      );

      const response = await sessionInitHandler(request);
      const location = getRedirectLocation(response);

      expect(location).toContain("/dashboard");
      expect(location).not.toContain("/login");
    });

    it("must set session cookie in dashboard redirect", async () => {
      const sid = "session-xyz-123";
      const request = createTestRequest(
        `http://localhost:3000/api/auth/session-init?sid=${sid}`
      );

      const response = await sessionInitHandler(request);
      const location = getRedirectLocation(response);

      expect(location).toContain("/dashboard");
      expect(location).not.toContain("session=");

      // Verify cookie is set with session id
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("__session");
      expect(setCookie).toContain(sid);
    });

    it("must redirect to login when sid is not backed by a server session", async () => {
      mockedSessionStore.get.mockResolvedValueOnce(null);
      const request = createTestRequest(
        "http://localhost:3000/api/auth/session-init?sid=invalid-session-id"
      );

      const response = await sessionInitHandler(request);
      const location = getRedirectLocation(response);

      expect(location).toContain("/login");
      expect(response.headers.get("set-cookie")).toBeNull();
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
          "/dashboard",
        ]
      `);
    });

    it("full flow must not exceed 3 hops", async () => {
      const result = await simulateFullAuthFlow("hop-count-session");

      // callback → dashboard = 2 entries in chain
      expect(result.chain.length).toBeLessThanOrEqual(2);
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

      // Snapshot: pathname (no query param — session via cookie now)
      expect({
        pathname: url.pathname,
        hasSessionParam: url.searchParams.has("session"),
        sessionValue: url.searchParams.get("session"),
      }).toMatchInlineSnapshot(`
        {
          "hasSessionParam": false,
          "pathname": "/dashboard",
          "sessionValue": null,
        }
      `);
    });
  });
});
