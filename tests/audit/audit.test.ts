import { NextRequest } from "next/server";
import { createTestRequest } from "../testServer";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { query } from "@/lib/db";
import { logError } from "@/lib/observability/logger";

jest.mock("@/lib/auth/get-auth-context", () => ({
  getAuthContext: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("@/lib/observability/logger", () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

import { logAudit, waitForPendingAuditLogs } from "@/lib/audit/audit";
import { GET as projectDetailGet } from "@/app/api/projects/[projectId]/route";
import { GET as projectFilesGet } from "@/app/api/projects/[projectId]/files/route";
import { POST as projectMessagesPost } from "@/app/api/projects/[projectId]/messages/route";
import { POST as taskCompletePost } from "@/app/api/tasks/[taskId]/complete/route";

const mockedGetAuthContext = getAuthContext as jest.MockedFunction<
  typeof getAuthContext
>;
const mockedQuery = query as jest.Mock;
const mockedLogError = logError as jest.MockedFunction<typeof logError>;

function buildAuthContext() {
  return {
    user: {
      id: "client-user-id",
      email: "client@example.com",
      displayName: "Client User",
      companyName: "Skill Wanderer",
      role: "client" as const,
      status: "active" as const,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    role: "client" as const,
    userId: "client-user-id",
  };
}

describe("Audit logging", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAuthContext.mockResolvedValue(buildAuthContext());
  });

  afterEach(async () => {
    await waitForPendingAuditLogs();
  });

  it("writes the correct audit row structure", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    logAudit({
      userId: "client-user-id",
      action: "task.complete",
      resource: "task",
      metadata: { taskId: "task-1" },
    });

    await waitForPendingAuditLogs();

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_logs"),
      [
        "client-user-id",
        "task.complete",
        "task",
        { taskId: "task-1" },
      ]
    );
  });

  it("inserts an audit log when a project is accessed", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "project-1",
            name: "Portal Refresh",
            summary: "Refresh the portal",
            status: "in_progress",
            start_date: "2024-01-01",
            target_date: "2024-03-01",
            last_updated_at: "2024-01-15T12:00:00.000Z",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "task-1",
            assigned_user_id: "client-user-id",
            title: "Review",
            description: "Review the draft",
            status: "open",
            due_date: null,
            completed_at: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "message-1",
            author_user_id: "client-user-id",
            body: "Update",
            created_at: "2024-01-15T13:00:00.000Z",
            read_at: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const response = await projectDetailGet(
      createTestRequest("http://localhost:3000/api/projects/project-1"),
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    await waitForPendingAuditLogs();

    expect(response.status).toBe(200);
    expect(mockedQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO audit_logs"),
      [
        "client-user-id",
        "project.access",
        "project",
        { projectId: "project-1", taskCount: 1, messageCount: 1 },
      ]
    );
  });

  it("inserts an audit log when files are accessed", async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: "project-1" }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "file-1",
            uploaded_by_user_id: "client-user-id",
            file_name: "brief.pdf",
            storage_key: "files/brief.pdf",
            mime_type: "application/pdf",
            size_bytes: "1024",
            category: "deliverable",
            created_at: "2024-01-15T13:00:00.000Z",
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const response = await projectFilesGet(
      createTestRequest("http://localhost:3000/api/projects/project-1/files"),
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    await waitForPendingAuditLogs();

    expect(response.status).toBe(200);
    expect(mockedQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO audit_logs"),
      [
        "client-user-id",
        "file.access",
        "file",
        { projectId: "project-1", fileCount: 1 },
      ]
    );
  });

  it("inserts an audit log when a message is sent", async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: "project-1" }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "message-1",
            author_user_id: "client-user-id",
            body: "Hello team",
            created_at: "2024-01-15T13:00:00.000Z",
            read_at: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const response = await projectMessagesPost(
      new NextRequest("http://localhost:3000/api/projects/project-1/messages", {
        method: "POST",
        body: JSON.stringify({ body: "Hello team" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    await waitForPendingAuditLogs();

    expect(response.status).toBe(201);
    expect(mockedQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO audit_logs"),
      [
        "client-user-id",
        "message.send",
        "message",
        { projectId: "project-1", messageId: "message-1" },
      ]
    );
  });

  it("keeps the task completion API successful when audit logging fails", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "task-1",
            project_id: "project-1",
            assigned_user_id: "client-user-id",
            title: "Approve mockup",
            description: "Approve the latest mockup",
            status: "done",
            due_date: null,
            completed_at: "2024-01-15T13:00:00.000Z",
          },
        ],
        rowCount: 1,
      })
      .mockRejectedValueOnce(new Error("audit insert failed"));

    const response = await taskCompletePost(
      createTestRequest("http://localhost:3000/api/tasks/task-1/complete"),
      { params: Promise.resolve({ taskId: "task-1" }) }
    );

    await waitForPendingAuditLogs();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      task: expect.objectContaining({ id: "task-1", status: "done" }),
    });
    expect(mockedLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "audit_log_failed",
        method: "AUDIT",
        path: "task",
      })
    );
  });
});