"use client";

import { useEffect } from "react";
import {
  consumePendingRuntimeReload,
  ensureCorrelationId,
  getLastBackendResponseMetadata,
  getLastRuntimeFailure,
  recordRuntimeFailure,
  scheduleControlledRuntimeReload,
} from "@/lib/runtime-correlation";
import {
  FRONTEND_FAILURE_CODES,
  shouldTriggerRuntimeReload,
  type RuntimeFailure,
} from "@/lib/runtime-failures";

function buildRuntimeFailure(options: {
  code: string;
  message: string;
  failureCode: string;
  recoveryHint: string;
  runtimeBoundary: string;
  retryable: boolean;
  correlationId?: string | null;
  requestId?: string | null;
  deploymentId?: string | null;
  contractVersion?: string | null;
}): RuntimeFailure {
  return {
    code: options.code,
    message: options.message,
    failureCode: options.failureCode,
    correlationId: ensureCorrelationId(options.correlationId),
    requestId: options.requestId ?? null,
    deploymentId: options.deploymentId ?? null,
    contractVersion: options.contractVersion ?? null,
    recoveryHint: options.recoveryHint,
    retryable: options.retryable,
    runtimeBoundary: options.runtimeBoundary,
    mutationId: null,
    replayGroupId: null,
    idempotentReplay: false,
    status: 0,
    capturedAt: Date.now(),
  };
}

function classifyRuntimeMessage(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  if (
    /hydration|did not match|text content does not match|server html/i.test(
      message
    )
  ) {
    return buildRuntimeFailure({
      code: "hydration_failed",
      message:
        "The browser detected a hydration mismatch while restoring the portal runtime.",
      failureCode: FRONTEND_FAILURE_CODES.FE_HYDRATION_FAILED,
      recoveryHint: "reload_runtime",
      runtimeBoundary: "frontend_runtime",
      retryable: true,
    });
  }

  if (
    /chunk|dynamically imported module|loading css chunk|failed to fetch dynamically imported module/i.test(
      message
    )
  ) {
    return buildRuntimeFailure({
      code: "stale_bundle",
      message: "The current portal bundle is stale and must be reloaded.",
      failureCode: FRONTEND_FAILURE_CODES.FE_STALE_BUNDLE,
      recoveryHint: "reload_runtime",
      runtimeBoundary: "frontend_runtime",
      retryable: true,
    });
  }

  return null;
}

export function RuntimeResilienceGuard() {
  useEffect(() => {
    const pendingReload = consumePendingRuntimeReload();

    if (pendingReload) {
      recordRuntimeFailure(
        buildRuntimeFailure({
          code: "runtime_reload",
          message:
            "The portal performed a controlled reload to recover from runtime skew.",
          failureCode: pendingReload.failureCode,
          recoveryHint: pendingReload.recoveryHint ?? "reload_runtime",
          runtimeBoundary: "frontend_runtime",
          retryable: true,
          correlationId: pendingReload.correlationId,
        })
      );
    }

    const lastBackendResponse = getLastBackendResponseMetadata();

    if (lastBackendResponse?.runtimeSkewDetected) {
      recordRuntimeFailure(
        buildRuntimeFailure({
          code: "runtime_skew",
          message:
            "The frontend runtime does not match the backend deployment metadata.",
          failureCode: FRONTEND_FAILURE_CODES.FE_DEPLOYMENT_MISMATCH,
          recoveryHint: "reload_runtime",
          runtimeBoundary: "frontend_runtime",
          retryable: true,
          correlationId: lastBackendResponse.correlationId,
          requestId: lastBackendResponse.requestId,
          deploymentId: lastBackendResponse.deploymentId,
          contractVersion: lastBackendResponse.contractVersion,
        })
      );

      scheduleControlledRuntimeReload({
        failureCode: FRONTEND_FAILURE_CODES.FE_DEPLOYMENT_MISMATCH,
        correlationId: lastBackendResponse.correlationId,
        recoveryHint: "reload_runtime",
      });
    }

    const handleOffline = () => {
      recordRuntimeFailure(
        buildRuntimeFailure({
          code: "offline",
          message: "The browser is offline.",
          failureCode: FRONTEND_FAILURE_CODES.FE_OFFLINE,
          recoveryHint: "wait_for_network",
          runtimeBoundary: "browser_runtime",
          retryable: true,
        })
      );
    };

    const handleOnline = () => {
      const lastFailure = getLastRuntimeFailure();

      if (lastFailure?.failureCode === FRONTEND_FAILURE_CODES.FE_OFFLINE) {
        scheduleControlledRuntimeReload({
          failureCode: FRONTEND_FAILURE_CODES.FE_OFFLINE,
          correlationId: lastFailure.correlationId,
          recoveryHint: "refresh_runtime",
        });
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      const failure = classifyRuntimeMessage(event.message ?? event.error?.message);

      if (!failure) {
        return;
      }

      recordRuntimeFailure(failure);

      if (shouldTriggerRuntimeReload(failure.failureCode)) {
        scheduleControlledRuntimeReload({
          failureCode: failure.failureCode,
          correlationId: failure.correlationId,
          recoveryHint: failure.recoveryHint,
        });
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : null;
      const failure = classifyRuntimeMessage(message);

      if (!failure) {
        return;
      }

      recordRuntimeFailure(failure);

      if (shouldTriggerRuntimeReload(failure.failureCode)) {
        scheduleControlledRuntimeReload({
          failureCode: failure.failureCode,
          correlationId: failure.correlationId,
          recoveryHint: failure.recoveryHint,
        });
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}