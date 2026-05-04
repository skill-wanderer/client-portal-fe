/**
 * Auth Contract Test
 * Validates: session-init without sid → must redirect to /login
 */

import { createTestRequest, getRedirectLocation } from "../testServer";

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

describe("Auth Contract: session-init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSessionStore.get.mockResolvedValue(validSession);
  });

  it("should redirect to /login when sid is missing", async () => {
    const request = createTestRequest(
      "http://localhost:3000/api/auth/session-init"
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).not.toBeNull();
    expect(location).toContain("/login");
  });

  it("should redirect to /login when sid is empty string", async () => {
    const request = createTestRequest(
      "http://localhost:3000/api/auth/session-init?sid="
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).not.toBeNull();
    expect(location).toContain("/login");
  });

  it("should NOT redirect to /login when sid is provided", async () => {
    const request = createTestRequest(
      "http://localhost:3000/api/auth/session-init?sid=valid-id"
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).not.toBeNull();
    expect(location).not.toContain("/login");
    expect(location).toContain("/dashboard");
  });

  it("should redirect to /login when sid is not backed by a server session", async () => {
    mockedSessionStore.get.mockResolvedValueOnce(null);
    const request = createTestRequest(
      "http://localhost:3000/api/auth/session-init?sid=invalid-id"
    );

    const response = await sessionInitHandler(request);
    const location = getRedirectLocation(response);

    expect(location).not.toBeNull();
    expect(location).toContain("/login");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("should always produce a redirect (never 200 OK)", async () => {
    const withSid = createTestRequest(
      "http://localhost:3000/api/auth/session-init?sid=abc"
    );
    const withoutSid = createTestRequest(
      "http://localhost:3000/api/auth/session-init"
    );

    const responseWithSid = await sessionInitHandler(withSid);
    const responseWithoutSid = await sessionInitHandler(withoutSid);

    // Both should be redirects (3xx)
    expect(responseWithSid.status).toBeGreaterThanOrEqual(300);
    expect(responseWithSid.status).toBeLessThan(400);
    expect(responseWithoutSid.status).toBeGreaterThanOrEqual(300);
    expect(responseWithoutSid.status).toBeLessThan(400);
  });
});
