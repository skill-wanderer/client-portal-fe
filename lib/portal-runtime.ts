import {
  ApiClientError,
  getApiClientErrorMessage,
  isConflictApiError,
  isForbiddenApiError,
  isNotFoundApiError,
  isUnauthenticatedApiError,
} from "@/lib/api-client";
import { redirectToLogin } from "@/lib/auth";

export const LOGIN_ERROR_MESSAGES = {
  invalid_state: "Login session expired. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
  session_expired: "Your session has expired. Please sign in again.",
  service_unavailable: "Service temporarily unavailable. Please try again later.",
  signed_out: "You have been signed out.",
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

  const loginError =
    error instanceof ApiClientError && error.code === "no_session"
      ? undefined
      : "session_expired";

  redirectToLogin(loginError);
  return true;
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