/**
 * Auth Middleware Test
 * Validates: ?session query bypasses auth, missing session redirects to /login
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

import { middleware } from "@/middleware";
import { sessionStore } from "@/lib/auth/session";

const mockedSessionStore = sessionStore as jest.Mocked<typeof sessionStore>;

describe("Auth Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Public paths bypass", () => {
    it("should allow /login without session", async () => {
      const request = createTestRequest("http://localhost:3000/login");
      const response = await middleware(request);

      // NextResponse.next() does not redirect
      expect(response.headers.get("location")).toBeNull();
      expect(response.status).not.toBe(307);
    });

    it("should allow /api/auth/* without session", async () => {
      const request = createTestRequest(
        "http://localhost:3000/api/auth/session-init?sid=abc"
      );
      const response = await middleware(request);

      expect(response.headers.get("location")).toBeNull();
      expect(response.status).not.toBe(307);
    });
  });

  describe("Query session bypass", () => {
    it("should allow access when ?session query param is present", async () => {
      const request = createTestRequest(
        "http://localhost:3000/dashboard?session=test-session-123"
      );
      const response = await middleware(request);

      expect(response.headers.get("location")).toBeNull();
      expect(response.status).not.toBe(307);
    });
  });

  describe("Protected routes without session", () => {
    it("should redirect to /login when no cookie and no query session", async () => {
      const request = createTestRequest("http://localhost:3000/dashboard");
      const response = await middleware(request);

      const location = response.headers.get("location");
      expect(location).toContain("/login");
    });

    it("should redirect to /login when cookie exists but session is invalid", async () => {
      mockedSessionStore.get.mockResolvedValue(null);

      const request = createTestRequest("http://localhost:3000/dashboard", {
        cookies: { __session: "invalid-session-id" },
      });
      const response = await middleware(request);

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
      const response = await middleware(request);

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
      const response = await middleware(request);

      const location = response.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("session_expired");
    });
  });
});
