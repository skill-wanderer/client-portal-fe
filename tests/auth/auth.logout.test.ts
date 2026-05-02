import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/logout/route";

const mockCookieStore = {
  get: jest.fn(),
  delete: jest.fn(),
};

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => mockCookieStore),
}));

jest.mock("@/lib/auth/keycloak", () => ({
  getLogoutUrl: jest.fn(),
}));

jest.mock("@/lib/auth/session", () => ({
  sessionStore: {
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieStore.get.mockReturnValue(undefined);
  });

  test("redirects to /login when no session cookie exists", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("__session");
  });
});