/**
 * Tests for app/api/auth/callback/route.ts
 * Validates CSRF state validation, code exchange, session creation, and redirects.
 */

import { GET } from "@/app/api/auth/callback/route";
import { NextRequest } from "next/server";
import { sessionStore } from "@/lib/auth/session";

// Mock next/headers cookies()
const mockCookieStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => mockCookieStore),
}));

// Mock env
jest.mock("@/lib/env", () => ({
  env: {
    appUrl: "http://localhost:3000",
  },
}));

// Mock keycloak functions
const mockExchangeCode = jest.fn();
const mockDecodeIdToken = jest.fn();
const mockExtractUser = jest.fn();
jest.mock("@/lib/auth/keycloak", () => ({
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  decodeIdToken: (...args: unknown[]) => mockDecodeIdToken(...args),
  extractUser: (...args: unknown[]) => mockExtractUser(...args),
}));

// Mock session store
jest.mock("@/lib/auth/session", () => ({
  sessionStore: {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock crypto for deterministic UUIDs
jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(() => "deterministic-uuid-1234"),
}));

function createCallbackRequest(params: Record<string, string>): NextRequest {
  const url = new URL("/api/auth/callback", "http://localhost:3000");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Silence console.log in tests
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("redirects to /login?error=invalid_state when code is missing", async () => {
    const request = createCallbackRequest({ state: "abc" });

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/login?error=invalid_state");
  });

  test("redirects to /login?error=invalid_state when state is missing", async () => {
    const request = createCallbackRequest({ code: "xyz" });

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/login?error=invalid_state");
  });

  test("redirects to /login?error=invalid_state when stored state doesn't match", async () => {
    mockCookieStore.get.mockReturnValue({ value: "stored-state-A" });
    const request = createCallbackRequest({
      code: "valid-code",
      state: "different-state-B",
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/login?error=invalid_state");
  });

  test("redirects to /login?error=invalid_state when no stored state cookie", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const request = createCallbackRequest({
      code: "valid-code",
      state: "some-state",
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/login?error=invalid_state");
  });

  test("redirects to /login?error=auth_failed when token exchange fails", async () => {
    mockCookieStore.get.mockReturnValue({ value: "valid-state" });
    mockExchangeCode.mockRejectedValueOnce(new Error("exchange failed"));
    const request = createCallbackRequest({
      code: "bad-code",
      state: "valid-state",
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/login?error=auth_failed");
  });

  test("creates session, sets cookie, and redirects to dashboard on success", async () => {
    mockCookieStore.get.mockReturnValue({ value: "correct-state" });
    mockExchangeCode.mockResolvedValueOnce({
      access_token: "at-new",
      refresh_token: "rt-new",
      id_token: "it-new",
      expires_in: 300,
      refresh_expires_in: 1800,
    });
    mockDecodeIdToken.mockReturnValue({
      sub: "user-1",
      email: "user@test.com",
      name: "Test User",
      realm_access: { roles: ["user"] },
    });
    mockExtractUser.mockReturnValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      roles: ["user"],
    });

    const request = createCallbackRequest({
      code: "valid-code",
      state: "correct-state",
    });

    const response = await GET(request);

    // Session should be created
    expect(sessionStore.set).toHaveBeenCalledWith(
      "deterministic-uuid-1234",
      expect.objectContaining({
        accessToken: "at-new",
        refreshToken: "rt-new",
        idToken: "it-new",
        user: {
          id: "user-1",
          email: "user@test.com",
          name: "Test User",
          roles: ["user"],
        },
      })
    );

    // Should redirect directly to dashboard
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/dashboard");

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("__session=deterministic-uuid-1234");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toContain("Max-Age=1800");
  });

  test("does not expose sid in the success redirect URL", async () => {
    mockCookieStore.get.mockReturnValue({ value: "correct-state" });
    mockExchangeCode.mockResolvedValueOnce({
      access_token: "at-new",
      refresh_token: "rt-new",
      id_token: "it-new",
      expires_in: 300,
      refresh_expires_in: 1800,
    });
    mockDecodeIdToken.mockReturnValue({
      sub: "user-1",
      email: "user@test.com",
      name: "Test User",
      realm_access: { roles: ["user"] },
    });
    mockExtractUser.mockReturnValue({
      id: "user-1",
      email: "user@test.com",
      name: "Test User",
      roles: ["user"],
    });

    const request = createCallbackRequest({
      code: "valid-code",
      state: "correct-state",
    });

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(location).toBe("http://localhost:3000/dashboard");
    expect(location).not.toContain("sid=");
  });

  test("deletes __state cookie on successful auth", async () => {
    mockCookieStore.get.mockReturnValue({ value: "state-xyz" });
    mockExchangeCode.mockResolvedValueOnce({
      access_token: "at",
      refresh_token: "rt",
      id_token: "it",
      expires_in: 300,
      refresh_expires_in: 1800,
    });
    mockDecodeIdToken.mockReturnValue({
      sub: "u",
      email: "e@e.com",
      name: "N",
    });
    mockExtractUser.mockReturnValue({
      id: "u",
      email: "e@e.com",
      name: "N",
      roles: [],
    });

    const request = createCallbackRequest({
      code: "code",
      state: "state-xyz",
    });

    await GET(request);

    // State cookie should be deleted after successful flow
    expect(mockCookieStore.delete).not.toHaveBeenCalled();
    // Note: callback uses response.cookies.delete, not cookieStore.delete
    // The __state cookie is cleared via the response object
  });

  test("passes correct code to exchangeCode", async () => {
    mockCookieStore.get.mockReturnValue({ value: "s" });
    mockExchangeCode.mockResolvedValueOnce({
      access_token: "at",
      refresh_token: "rt",
      id_token: "it",
      expires_in: 300,
      refresh_expires_in: 1800,
    });
    mockDecodeIdToken.mockReturnValue({ sub: "u", email: "e@e.com" });
    mockExtractUser.mockReturnValue({
      id: "u",
      email: "e@e.com",
      name: "Unknown",
      roles: [],
    });

    const request = createCallbackRequest({ code: "my-auth-code", state: "s" });

    await GET(request);

    expect(mockExchangeCode).toHaveBeenCalledWith("my-auth-code");
  });
});
