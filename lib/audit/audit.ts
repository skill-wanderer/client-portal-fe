import { query } from "@/lib/db";
import { logError } from "@/lib/observability/logger";

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  resource: string;
  metadata?: Record<string, unknown> | null;
}

const pendingAuditLogs = new Set<Promise<void>>();

function trackPendingAuditLog(operation: Promise<void>) {
  pendingAuditLogs.add(operation);

  void operation.finally(() => {
    pendingAuditLogs.delete(operation);
  });
}

export function logAudit(input: AuditLogInput) {
  const operation = Promise.resolve()
    .then(async () => {
      await query(
        `
          INSERT INTO audit_logs (
            user_id,
            action,
            resource,
            metadata
          )
          VALUES ($1, $2, $3, $4)
        `,
        [input.userId ?? null, input.action, input.resource, input.metadata ?? null]
      );
    })
    .catch((error) => {
      logError({
        message: "audit_log_failed",
        method: "AUDIT",
        path: input.resource,
        error,
      });
    });

  trackPendingAuditLog(operation);
}

export async function waitForPendingAuditLogs() {
  await Promise.allSettled([...pendingAuditLogs]);
}