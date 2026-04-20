/**
 * Tests for lib/auth/keycloak.ts
 * Validates URL construction, token exchange, token refresh, and id_token decoding.
 */

import {
  getAuthorizationUrl,
  getLogoutUrl,
  decodeIdToken,
  extractUser,
  exchangeCode,
  refreshAccessToken,
} from "@/lib/auth/keycloak";

// Mock env module
jest.mock("@/lib/env", () => ({
  env: {
    appUrl: "http://localhost:3000",
    keycloakUrl: "http://localhost:8080",
    keycloakRealm: "test-realm",
    keycloakClientId: "test-client",
    keycloakClientSecret: "test-secret",
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("keycloak — URL builders", () => {
  test("getAuthorizationUrl generates correct Keycloak URL", () => {
    const url = getAuthorizationUrl("test-state-123");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("http://localhost:8080");
    expect(parsed.pathname).toBe(
      "/realms/test-realm/protocol/openid-connect/auth"
    );
    expect(parsed.searchParams.get("client_id")).toBe("test-client");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback"
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("openid");
    expect(parsed.searchParams.get("state")).toBe("test-state-123");
  });

  test("getLogoutUrl generates correct logout URL", () => {
    const url = getLogoutUrl("mock-id-token");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("http://localhost:8080");
    expect(parsed.pathname).toBe(
      "/realms/test-realm/protocol/openid-connect/logout"
    );
    expect(parsed.searchParams.get("id_token_hint")).toBe("mock-id-token");
    expect(parsed.searchParams.get("post_logout_redirect_uri")).toBe(
      "http://localhost:3000/login"
    );
  });
});

describe("keycloak — token exchange", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const mockTokenResponse = {
    access_token: "at-123",
    refresh_token: "rt-123",
    id_token: "it-123",
    expires_in: 300,
    refresh_expires_in: 1800,
  };

  test("exchangeCode sends correct request and returns tokens", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    });

    const result = await exchangeCode("auth-code-xyz");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/realms/test-realm/protocol/openid-connect/token"
    );
    expect(options.method).toBe("POST");

    const body = new URLSearchParams(options.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code-xyz");
    expect(body.get("client_id")).toBe("test-client");
    expect(body.get("client_secret")).toBe("test-secret");

    expect(result).toEqual(mockTokenResponse);
  });

  test("exchangeCode throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "invalid_grant",
    });

    await expect(exchangeCode("bad-code")).rejects.toThrow(
      "Token exchange failed: 400 invalid_grant"
    );
  });

  test("refreshAccessToken sends correct request and returns tokens", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    });

    const result = await refreshAccessToken("rt-old");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8080/realms/test-realm/protocol/openid-connect/token"
    );

    const body = new URLSearchParams(options.body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-old");
    expect(body.get("client_id")).toBe("test-client");
    expect(body.get("client_secret")).toBe("test-secret");

    expect(result).toEqual(mockTokenResponse);
  });

  test("refreshAccessToken throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "token_expired",
    });

    await expect(refreshAccessToken("expired-rt")).rejects.toThrow(
      "Token refresh failed: 401 token_expired"
    );
  });
});

describe("keycloak — id_token decoding", () => {
  function createMockIdToken(payload: object): string {
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
      "base64url"
    );
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = "mock-signature";
    return `${header}.${body}.${signature}`;
  }

  test("decodeIdToken extracts payload from valid JWT", () => {
    const token = createMockIdToken({
      sub: "user-1",
      email: "test@example.com",
      name: "Test User",
      realm_access: { roles: ["admin"] },
    });

    const result = decodeIdToken(token);

    expect(result.sub).toBe("user-1");
    expect(result.email).toBe("test@example.com");
    expect(result.name).toBe("Test User");
    expect(result.realm_access?.roles).toEqual(["admin"]);
  });

  test("decodeIdToken throws on invalid format", () => {
    expect(() => decodeIdToken("not-a-jwt")).toThrow(
      "Invalid id_token format"
    );
    expect(() => decodeIdToken("only.two")).toThrow("Invalid id_token format");
  });

  test("extractUser maps payload to User object", () => {
    const payload = {
      sub: "u-123",
      email: "user@test.com",
      name: "Full Name",
      realm_access: { roles: ["viewer", "editor"] },
    };

    const user = extractUser(payload);

    expect(user).toEqual({
      id: "u-123",
      email: "user@test.com",
      name: "Full Name",
      roles: ["viewer", "editor"],
    });
  });

  test("extractUser handles missing name (falls back to preferred_username)", () => {
    const payload = {
      sub: "u-456",
      email: "no-name@test.com",
      preferred_username: "noname",
    };

    const user = extractUser(payload);

    expect(user.name).toBe("noname");
    expect(user.roles).toEqual([]);
  });

  test("extractUser handles no name and no preferred_username", () => {
    const payload = {
      sub: "u-789",
      email: "anon@test.com",
    };

    const user = extractUser(payload);

    expect(user.name).toBe("Unknown");
  });
});
