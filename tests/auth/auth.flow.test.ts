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

const mockSessionStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.mock("@/lib/auth/session-factory", () => ({
  createSessionStore: jest.fn(() => mockSessionStore),
}));

// Import after mock
import { GET as sessionInitHandler } from "@/app/api/auth/session-init/route";

const mockedSessionStore = mockSessionStore;

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

describe("Auth Flow: session-init → dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSessionStore.get.mockResolvedValue(validSession);
  });

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
    expect(setCookie).toContain("Secure");
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Max-Age=\d+/);
  });
});
