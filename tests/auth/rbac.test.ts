import { createTestRequest } from "../testServer";
import { ForbiddenRoleError, requireRole } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { query } from "@/lib/db";

jest.mock("@/lib/auth/get-auth-context", () => ({
  getAuthContext: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  query: jest.fn(),
}));

import { GET as dashboardGet } from "@/app/api/dashboard/route";
import { GET as adminRbacCheckGet } from "@/app/api/admin/rbac-check/route";

const mockedGetAuthContext = getAuthContext as jest.MockedFunction<
  typeof getAuthContext
>;
const mockedQuery = query as jest.Mock;

function buildAuthContext(role: "client" | "admin") {
  return {
    user: {
      id: `${role}-user-id`,
      email: `${role}@example.com`,
      displayName: `${role} user`,
      companyName: "Skill Wanderer",
      role,
      status: "active",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    role,
    userId: `${role}-user-id`,
  };
}

describe("RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("allows a matching role", () => {
    expect(() => requireRole({ role: "client" }, ["client"]))
      .not.toThrow();
  });

  it("rejects a disallowed role", () => {
    expect(() => requireRole({ role: "admin" }, ["client"]))
      .toThrow(ForbiddenRoleError);
  });

  it("rejects a missing role", () => {
    expect(() => requireRole({ role: undefined } as never, ["client"]))
      .toThrow(ForbiddenRoleError);
  });

  it("allows a client user to access the dashboard", async () => {
    mockedGetAuthContext.mockResolvedValue(buildAuthContext("client"));
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "project-1",
            name: "Portal Refresh",
            summary: "Summary",
            status: "active",
            start_date: "2024-01-01",
            target_date: "2024-03-01",
            last_updated_at: "2024-01-15T12:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "task-1",
            project_id: "project-1",
            title: "Send approval",
            description: "Need approval",
            status: "open",
            due_date: "2024-02-01T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "2" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "file-1",
            project_id: "project-1",
            file_name: "brief.pdf",
            category: "brief",
            created_at: "2024-01-20T00:00:00.000Z",
          },
        ],
      });

    const response = await dashboardGet(
      createTestRequest("http://localhost:3000/api/dashboard")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: expect.objectContaining({ role: "client" }),
      summary: {
        activeProjects: 1,
        pendingActions: 1,
        unreadMessages: 2,
        recentFiles: 1,
      },
    });
    expect(mockedQuery).toHaveBeenCalledTimes(4);
  });

  it("returns a deterministic 403 when a disallowed role hits the dashboard", async () => {
    mockedGetAuthContext.mockResolvedValue(buildAuthContext("admin"));

    const response = await dashboardGet(
      createTestRequest("http://localhost:3000/api/dashboard")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "forbidden",
      reason: "insufficient_role",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("returns a deterministic 403 when the role is missing", async () => {
    mockedGetAuthContext.mockResolvedValue({
      user: {
        id: "user-without-role",
        email: "missing-role@example.com",
        displayName: "Missing Role",
        companyName: "Skill Wanderer",
        role: undefined,
        status: "active",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      role: undefined,
      userId: "user-without-role",
    } as never);

    const response = await dashboardGet(
      createTestRequest("http://localhost:3000/api/dashboard")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "forbidden",
      reason: "insufficient_role",
    });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("allows an admin user through the admin-only route", async () => {
    mockedGetAuthContext.mockResolvedValue(buildAuthContext("admin"));

    const response = await adminRbacCheckGet(
      createTestRequest("http://localhost:3000/api/admin/rbac-check")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("blocks a client user from the admin-only route", async () => {
    mockedGetAuthContext.mockResolvedValue(buildAuthContext("client"));

    const response = await adminRbacCheckGet(
      createTestRequest("http://localhost:3000/api/admin/rbac-check")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "forbidden",
      reason: "insufficient_role",
    });
  });
});