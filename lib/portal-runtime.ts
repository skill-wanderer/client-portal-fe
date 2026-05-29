import {
  ApiClientError,
  getApiClientErrorMessage,
  getApiClientRuntimeFailure,
  isConflictApiError,
  isForbiddenApiError,
  isNotFoundApiError,
  isUnauthenticatedApiError,
} from "@/lib/api-client";
import { redirectToLogin } from "@/lib/auth";
import {
  BACKEND_FAILURE_CODES,
  FRONTEND_FAILURE_CODES,
  getRuntimeFailureMessage,
  isRecoverableAuthFailure,
} from "@/lib/runtime-failures";

export const LOGIN_ERROR_MESSAGES = {
  invalid_state: "Login request expired. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
  session_expired: "Your session has expired. Please sign in again.",
  service_unavailable: "Service temporarily unavailable. Please try again later.",
  signed_out: "You have been signed out of the client portal.",
  runtime_skew: "A newer portal deployment is available. Reload and try again.",
  offline: "You are offline. Reconnect and try again.",
  auth_recovery_failed: "We could not resume the sign-in flow. Start again.",
} as const;

export function getLoginErrorMessage(errorCode?: string) {
  if (!errorCode) {
    return null;
  }

  return LOGIN_ERROR_MESSAGES[errorCode as keyof typeof LOGIN_ERROR_MESSAGES] ?? null;
}

export function redirectToLoginForApiError(error: unknown) {
  if (!isUnauthenticatedApiError(error)) {
    return false;
  }

  const runtimeFailure = getApiClientRuntimeFailure(error);

  const loginError =
    runtimeFailure && isRecoverableAuthFailure(runtimeFailure)
      ? "session_expired"
      : error instanceof ApiClientError && error.code === "no_session"
      ? undefined
      : "session_expired";

  redirectToLogin(loginError);
  return true;
}

export function getPortalRuntimeErrorMessage(error: unknown, fallback: string) {
  const runtimeFailure = getApiClientRuntimeFailure(error);

  if (runtimeFailure) {
    return getRuntimeFailureMessage(runtimeFailure, fallback);
  }

  return getApiClientErrorMessage(error, fallback);
}

export function isProvisioningApiError(error: unknown) {
  return (
    isForbiddenApiError(error) &&
    error instanceof ApiClientError &&
    (error.code === "no_mapping" ||
      error.code === "invalid_role" ||
      error.code === "forbidden")
  );
}

interface MutationMessageOptions {
  defaultMessage: string;
  validationMessage?: string;
  provisioningMessage?: string;
  notFoundMessage?: string;
  conflictMessage?: string;
}

export function getPortalMutationErrorMessage(
  error: unknown,
  options: MutationMessageOptions
) {
  const runtimeFailure = getApiClientRuntimeFailure(error);

  if (runtimeFailure?.failureCode === FRONTEND_FAILURE_CODES.FE_OFFLINE) {
    return "You appear to be offline. Reconnect before retrying this change.";
  }

  if (runtimeFailure?.failureCode === FRONTEND_FAILURE_CODES.FE_API_TIMEOUT) {
    return "The backend did not confirm this change in time. Refresh the latest state before retrying.";
  }

  if (
    runtimeFailure?.failureCode ===
      BACKEND_FAILURE_CODES.BE_MUTATION_STALE_WRITE &&
    options.conflictMessage
  ) {
    return options.conflictMessage;
  }

  if (
    runtimeFailure?.failureCode ===
      BACKEND_FAILURE_CODES.BE_IDEMPOTENCY_CONFLICT &&
    options.conflictMessage
  ) {
    return options.conflictMessage;
  }

  if (error instanceof ApiClientError) {
    if (error.code === "validation_error" && options.validationMessage) {
      return options.validationMessage;
    }

    if (isProvisioningApiError(error) && options.provisioningMessage) {
      return options.provisioningMessage;
    }

    if (isNotFoundApiError(error) && options.notFoundMessage) {
      return options.notFoundMessage;
    }

    if (isConflictApiError(error) && options.conflictMessage) {
      return options.conflictMessage;
    }
  }

  return getApiClientErrorMessage(error, options.defaultMessage);
}