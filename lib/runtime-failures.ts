export const FRONTEND_FAILURE_CODES = {
  FE_HYDRATION_FAILED: "FE_HYDRATION_FAILED",
  FE_RUNTIME_SKEW: "FE_RUNTIME_SKEW",
  FE_RUNTIME_CONFIG_INVALID: "FE_RUNTIME_CONFIG_INVALID",
  FE_API_TIMEOUT: "FE_API_TIMEOUT",
  FE_API_ABORTED: "FE_API_ABORTED",
  FE_AUTH_BOOTSTRAP_FAILED: "FE_AUTH_BOOTSTRAP_FAILED",
  FE_STALE_BUNDLE: "FE_STALE_BUNDLE",
  FE_OFFLINE: "FE_OFFLINE",
  FE_DEPLOYMENT_MISMATCH: "FE_DEPLOYMENT_MISMATCH",
} as const;

export const BACKEND_FAILURE_CODES = {
  BE_SESSION_LOOKUP_FAILED: "BE_SESSION_LOOKUP_FAILED",
  BE_SESSION_EXPIRED: "BE_SESSION_EXPIRED",
  BE_KEYCLOAK_UNAVAILABLE: "BE_KEYCLOAK_UNAVAILABLE",
  BE_PROXY_MISMATCH: "BE_PROXY_MISMATCH",
  BE_CORS_DENIED: "BE_CORS_DENIED",
  BE_DEPLOYMENT_SKEW: "BE_DEPLOYMENT_SKEW",
  BE_MUTATION_STALE_WRITE: "BE_MUTATION_STALE_WRITE",
  BE_IDEMPOTENCY_CONFLICT: "BE_IDEMPOTENCY_CONFLICT",
} as const;

export type FrontendFailureCode =
  (typeof FRONTEND_FAILURE_CODES)[keyof typeof FRONTEND_FAILURE_CODES];
export type BackendFailureCode =
  (typeof BACKEND_FAILURE_CODES)[keyof typeof BACKEND_FAILURE_CODES];
export type RuntimeFailureCode = FrontendFailureCode | BackendFailureCode | string;

export interface RuntimeFailure {
  code: string;
  message: string;
  failureCode: RuntimeFailureCode;
  correlationId: string | null;
  requestId: string | null;
  deploymentId: string | null;
  contractVersion: string | null;
  recoveryHint: string | null;
  retryable: boolean;
  runtimeBoundary: string;
  mutationId: string | null;
  replayGroupId: string | null;
  idempotentReplay: boolean;
  status: number;
  capturedAt: number;
}

export function isRecoverableAuthFailure(failure: RuntimeFailure | null) {
  if (!failure) {
    return false;
  }

  const recoverableFailureCodes: readonly string[] = [
    BACKEND_FAILURE_CODES.BE_SESSION_EXPIRED,
    BACKEND_FAILURE_CODES.BE_SESSION_LOOKUP_FAILED,
    BACKEND_FAILURE_CODES.BE_KEYCLOAK_UNAVAILABLE,
    FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
  ];

  return recoverableFailureCodes.includes(failure.failureCode);
}

export function isMutationRecoveryFailure(failure: RuntimeFailure | null) {
  if (!failure) {
    return false;
  }

  const mutationFailureCodes: readonly string[] = [
    BACKEND_FAILURE_CODES.BE_MUTATION_STALE_WRITE,
    BACKEND_FAILURE_CODES.BE_IDEMPOTENCY_CONFLICT,
    FRONTEND_FAILURE_CODES.FE_API_TIMEOUT,
    FRONTEND_FAILURE_CODES.FE_OFFLINE,
  ];

  return mutationFailureCodes.includes(failure.failureCode);
}

export function shouldAutoRetrySafeRequest(
  method: string,
  failure: Pick<RuntimeFailure, "failureCode" | "retryable">,
  attempt: number
) {
  if (attempt >= 1) {
    return false;
  }

  const normalizedMethod = method.toUpperCase();

  if (!["GET", "HEAD"].includes(normalizedMethod) || !failure.retryable) {
    return false;
  }

  const retryableSafeFailureCodes: readonly string[] = [
    FRONTEND_FAILURE_CODES.FE_API_TIMEOUT,
    FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
    BACKEND_FAILURE_CODES.BE_SESSION_LOOKUP_FAILED,
    BACKEND_FAILURE_CODES.BE_KEYCLOAK_UNAVAILABLE,
  ];

  return retryableSafeFailureCodes.includes(failure.failureCode);
}

export function shouldTriggerRuntimeReload(failureCode: string | null | undefined) {
  const reloadFailureCodes: readonly string[] = [
    FRONTEND_FAILURE_CODES.FE_HYDRATION_FAILED,
    FRONTEND_FAILURE_CODES.FE_RUNTIME_SKEW,
    FRONTEND_FAILURE_CODES.FE_STALE_BUNDLE,
    FRONTEND_FAILURE_CODES.FE_DEPLOYMENT_MISMATCH,
    BACKEND_FAILURE_CODES.BE_DEPLOYMENT_SKEW,
  ];

  return reloadFailureCodes.includes(failureCode ?? "");
}

export function getRuntimeFailureMessage(
  failure: RuntimeFailure | null,
  fallback: string
) {
  if (!failure) {
    return fallback;
  }

  switch (failure.failureCode) {
    case FRONTEND_FAILURE_CODES.FE_HYDRATION_FAILED:
      return "The browser runtime became inconsistent while loading this page. Reload the portal.";
    case FRONTEND_FAILURE_CODES.FE_RUNTIME_CONFIG_INVALID:
      return "The deployed frontend runtime configuration is invalid. Verify the public API origin, deployment metadata, and contract version.";
    case FRONTEND_FAILURE_CODES.FE_RUNTIME_SKEW:
    case FRONTEND_FAILURE_CODES.FE_DEPLOYMENT_MISMATCH:
    case BACKEND_FAILURE_CODES.BE_DEPLOYMENT_SKEW:
      return "A newer deployment is available. Reload the portal to continue safely.";
    case FRONTEND_FAILURE_CODES.FE_STALE_BUNDLE:
      return "The portal assets are out of date. Reload the page and try again.";
    case FRONTEND_FAILURE_CODES.FE_API_TIMEOUT:
      return "The backend took too long to respond. Retry the request if it is still needed.";
    case FRONTEND_FAILURE_CODES.FE_API_ABORTED:
      return "The request was interrupted before the backend responded.";
    case FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED:
      return "We could not restore your authenticated session from the browser runtime. Try signing in again.";
    case FRONTEND_FAILURE_CODES.FE_OFFLINE:
      return "You appear to be offline. Reconnect to the network and retry.";
    case BACKEND_FAILURE_CODES.BE_SESSION_LOOKUP_FAILED:
      return "The backend could not restore your session. Retry or sign in again.";
    case BACKEND_FAILURE_CODES.BE_SESSION_EXPIRED:
      return "Your session has expired. Sign in again to continue.";
    case BACKEND_FAILURE_CODES.BE_KEYCLOAK_UNAVAILABLE:
      return "The sign-in service is temporarily unavailable. Retry the login flow shortly.";
    case BACKEND_FAILURE_CODES.BE_PROXY_MISMATCH:
      return "The request could not be trusted because the upstream proxy metadata was inconsistent.";
    case BACKEND_FAILURE_CODES.BE_CORS_DENIED:
      return "This browser origin is not allowed to access the backend runtime.";
    case BACKEND_FAILURE_CODES.BE_MUTATION_STALE_WRITE:
      return "This record changed before your update completed. Refresh the page before retrying.";
    case BACKEND_FAILURE_CODES.BE_IDEMPOTENCY_CONFLICT:
      return "This change is already in progress or reused a conflicting idempotency key. Confirm the latest state before retrying.";
    default:
      return fallback;
  }
}