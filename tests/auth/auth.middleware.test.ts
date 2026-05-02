/**
 * Auth Middleware Test
 * Validates: missing session redirects to /login, valid session allows access
 */

import { createTestRequest } from "../testServer";

// Mock session store
jest.mock("@/lib/auth/session", () => ({
  sessionStore: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockRefreshAccessToken = jest.fn();
jest.mock("@/lib/auth/keycloak", () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

import { proxy } from "@/proxy";
import { sessionStore } from "@/lib/auth/session";

const mockedSessionStore = sessionStore as jest.Mocked<typeof sessionStore>;

describe("Auth Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Public paths bypass", () => {
    it("should allow /login without session", async () => {
      const request = createTestRequest("http://localhost:3000/login");
      const response = await proxy(request);

      // NextResponse.next() does not redirect
      expect(response.headers.get("location")).toBeNull();
      expect(response.status).not.toBe(307);
    });

    it("should allow /api/auth/* without session", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/session-init?sid=abc"
      );
      const response = await proxy(request);

      expect(response.headers.get("location")).toBeNull();
      expect(response.status).not.toBe(307);
    });
  });

  describe("Protected routes without session", () => {
    it("should redirect to /login when no cookie present", async () => {
      const request = createTestRequest("http://localhost:3000/dashboard");
      const response = await proxy(request);

      const location = response.headers.get("location");
      expect(location).toContain("/login");
    });

    it("should redirect to /login when cookie exists but session is invalid", async () => {
      mockedSessionStore.get.mockResolvedValue(null);

      const request = createTestRequest("http://localhost:3000/dashboard", {
        cookies: { __session: "invalid-session-id" },
      });
      const response = await proxy(request);

      const location = response.headers.get("location");
      expect(location).toContain("/login");
    });

    it("should allow access when cookie session is valid", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      mockedSessionStore.get.mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        idToken: "it",
        user: { id: "1", email: "test@test.com", name: "Test", roles: [] },
        accessExpiresAt: futureTime,
        refreshExpiresAt: futureTime,
        createdAt: Math.floor(Date.now() / 1000),
      });

      const request = createTestRequest("http://localhost:3000/dashboard", {
        cookies: { __session: "valid-session-id" },
      });
      const response = await proxy(request);

      expect(response.headers.get("location")).toBeNull();
    });

    it("should redirect to /login when session refresh token is expired", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      mockedSessionStore.get.mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        idToken: "it",
        user: { id: "1", email: "test@test.com", name: "Test", roles: [] },
        accessExpiresAt: pastTime,
        refreshExpiresAt: pastTime,
        createdAt: Math.floor(Date.now() / 1000) - 7200,
      });

      const request = createTestRequest("http://localhost:3000/dashboard", {
        cookies: { __session: "expired-session-id" },
      });
      const response = await proxy(request);

      const location = response.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("session_expired");
    });

    it("should refresh the session when access token is expired but refresh token is valid", async () => {
      const fixedNowMs = 1_700_000_000_000;
      jest.spyOn(Date, "now").mockReturnValue(fixedNowMs);

      mockedSessionStore.get.mockResolvedValue({
        accessToken: "at-old",
        refreshToken: "rt-old",
        idToken: "it-old",
        user: { id: "1", email: "test@test.com", name: "Test", roles: [] },
        accessExpiresAt: Math.floor(fixedNowMs / 1000) - 60,
        refreshExpiresAt: Math.floor(fixedNowMs / 1000) + 1800,
        createdAt: Math.floor(fixedNowMs / 1000) - 300,
      });
      mockRefreshAccessToken.mockResolvedValue({
        access_token: "at-new",
        refresh_token: "rt-new",
        id_token: "it-new",
        expires_in: 300,
        refresh_expires_in: 1800,
      });

      const request = createTestRequest("http://localhost:3000/dashboard", {
        cookies: { __session: "valid-session-id" },
      });
      const response = await proxy(request);

      expect(response.headers.get("location")).toBeNull();
      expect(mockRefreshAccessToken).toHaveBeenCalledWith("rt-old");
      expect(mockedSessionStore.set).toHaveBeenCalledWith(
        "valid-session-id",
        expect.objectContaining({
          accessToken: "at-new",
          refreshToken: "rt-new",
          idToken: "it-new",
          accessExpiresAt: Math.floor(fixedNowMs / 1000) + 300,
          refreshExpiresAt: Math.floor(fixedNowMs / 1000) + 1800,
        })
      );

      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("__session=valid-session-id");
      expect(setCookie).toContain("Secure");
      expect(setCookie).toMatch(/SameSite=Strict/i);
      expect(setCookie).toContain("Max-Age=1800");
    });
  });
});
