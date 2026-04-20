/**
 * Tests for app/api/auth/login/route.ts
 * Validates CSRF state generation, cookie setting, and redirect to Keycloak.
 */

import { GET } from "@/app/api/auth/login/route";

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
        secure: false,
        sameSite: "none",
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

  test("reuses existing state cookie if present (prevents double-login)", async () => {
    mockCookieStore.get.mockReturnValue({ value: "existing-state-abc" });

    const response = await GET();

    // Should NOT set a new cookie
    expect(mockCookieStore.set).not.toHaveBeenCalled();

    // Should redirect with existing state
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://keycloak/auth?state=existing-state-abc");
  });

  test("state cookie has correct security attributes", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    await GET();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("none");
    expect(options.maxAge).toBe(300);
  });
});
