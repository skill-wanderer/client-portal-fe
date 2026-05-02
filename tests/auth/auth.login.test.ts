/**
 * Tests for app/api/auth/login/route.ts
 * Validates CSRF state generation, cookie setting, and redirect to Keycloak.
 */

import { GET } from "@/app/api/auth/login/route";

jest.mock("@/lib/env", () => ({
  env: {
    appUrl: "https://client-portal.test:3000",
  },
}));

// Mock next/headers cookies()
const mockCookieStore = {
  get: jest.fn(),
  set: jest.fn(),
};
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => mockCookieStore),
}));

// Mock keycloak
jest.mock("@/lib/auth/keycloak", () => ({
  getAuthorizationUrl: jest.fn(
    (state: string) => `http://keycloak/auth?state=${state}`
  ),
}));

// Mock crypto for deterministic state
jest.mock("node:crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: () => "deterministic-state-hex-value-for-testing",
  })),
}));

describe("GET /api/auth/login", () => {
  beforeEach(() => {
    mockCookieStore.get.mockReset();
    mockCookieStore.set.mockReset();
  });

  test("generates new state and redirects to Keycloak when no existing state", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const response = await GET();

    // Should set state cookie
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "__state",
      "deterministic-state-hex-value-for-testing",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      })
    );

    // Should redirect to Keycloak
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("keycloak/auth");
    expect(location).toContain(
      "state=deterministic-state-hex-value-for-testing"
    );
  });

  test("always generates a fresh state even when a prior state cookie exists", async () => {
    mockCookieStore.get.mockReturnValue({ value: "existing-state-abc" });

    const response = await GET();

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "__state",
      "deterministic-state-hex-value-for-testing",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      })
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe(
      "http://keycloak/auth?state=deterministic-state-hex-value-for-testing"
    );
    expect(location).not.toContain("existing-state-abc");
  });

  test("state cookie has correct security attributes", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await GET();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.maxAge).toBe(300);
  });
});
