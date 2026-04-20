/**
 * Auth Flow Test
 * Validates: session-init with valid sid → redirects to dashboard (NOT back to login)
 */

import { createTestRequest, getRedirectLocation } from "../testServer";

// Mock env before importing route
jest.mock("@/lib/env", () => ({
  env: {
    appUrl: "http://localhost:3000",
  },
}));

// Import after mock
import { GET as sessionInitHandler } from "@/app/api/auth/session-init/route";

describe("Auth Flow: session-init → dashboard", () => {
  it("should redirect to /dashboard and set session cookie when sid is provided", async () => {
    const request = createTestRequest(
      "http://localhost:3000/api/auth/session-init?sid=test-session-id-123"
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).not.toBeNull();
    expect(location).toContain("/dashboard");
    expect(location).not.toContain("session=");

    // Verify cookie is set
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("__session");
    expect(setCookie).toContain("test-session-id-123");
  });

  it("should NOT redirect back to /login when sid is provided", async () => {
    const request = createTestRequest(
      "http://localhost:3000/api/auth/session-init?sid=valid-session"
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).not.toBeNull();
    expect(location).not.toMatch(/\/login/);
  });

  it("should set httpOnly cookie with session id", async () => {
    const sessionId = "abc-def-ghi-jkl";
    const request = createTestRequest(
      `http://localhost:3000/api/auth/session-init?sid=${sessionId}`
    );

    const response = await sessionInitHandler(request);
    const setCookie = response.headers.get("set-cookie");

    expect(setCookie).toContain(sessionId);
    expect(setCookie).toContain("HttpOnly");
  });
});
