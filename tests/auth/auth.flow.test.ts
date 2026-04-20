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
  it("should redirect to /dashboard?session=<sid> when sid is provided", async () => {
    const request = createTestRequest(
      "http://localhost:3000/api/auth/session-init?sid=test-session-id-123"
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).not.toBeNull();
    expect(location).toContain("/dashboard");
    expect(location).toContain("session=test-session-id-123");
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

  it("should preserve the session id in the redirect URL", async () => {
    const sessionId = "abc-def-ghi-jkl";
    const request = createTestRequest(
      `http://localhost:3000/api/auth/session-init?sid=${sessionId}`
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).toContain(sessionId);
  });
});
