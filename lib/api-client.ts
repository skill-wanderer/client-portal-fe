import { env } from "@/lib/env";

export type ApiErrorCode = string;

interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
}

interface ApiSuccessEnvelope<TData> {
  success: true;
  data: TData;
  error?: null;
}

interface ApiFailureEnvelope {
  success: false;
  data?: null;
  error: ApiErrorPayload | null;
}

type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiFailureEnvelope;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly correlationId: string | null;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    correlationId?: string | null;
  }) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.correlationId = options.correlationId ?? null;
  }
}

function isApiEnvelope<TData>(value: unknown): value is ApiEnvelope<TData> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    ("data" in value || "error" in value)
  );
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorCode(status: number, payload: unknown) {
  if (isApiEnvelope(payload) && payload.error?.code) {
    return payload.error.code;
  }

  if (status === 400) {
    return "validation_error";
  }

  if (status === 401) {
    return "unauthorized";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "resource_not_found";
  }

  if (status === 409) {
    return "conflict";
  }

  if (status === 412) {
    return "precondition_failed";
  }

  if (status === 503) {
    return "service_unavailable";
  }

  return "request_failed";
}

function getErrorMessage(status: number, payload: unknown) {
  if (isApiEnvelope(payload) && payload.error?.message) {
    return payload.error.message;
  }

  if (status === 401) {
    return "Your session is no longer valid.";
  }

  if (status === 403) {
    return "Your account is signed in but not authorized for this action.";
  }

  if (status === 404) {
    return "The requested resource is no longer available.";
  }

  if (status === 409 || status === 412) {
    return "The request could not be applied because the resource changed on the backend.";
  }

  if (status === 503) {
    return "The backend service is temporarily unavailable.";
  }

  return "The backend request failed.";
}

function createApiClientError(response: Response, payload: unknown) {
  return new ApiClientError({
    message: getErrorMessage(response.status, payload),
    status: response.status,
    code: getErrorCode(response.status, payload),
    correlationId: response.headers.get("X-Correlation-ID"),
  });
}

function createNetworkError(error: unknown) {
  return new ApiClientError({
    message:
      error instanceof Error
        ? error.message
        : "The backend request could not be completed.",
    status: 0,
    code: "network_error",
  });
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function isUnauthenticatedApiError(error: unknown) {
  return (
    isApiClientError(error) &&
    (error.status === 401 ||
      error.code === "unauthorized" ||
      error.code === "no_session" ||
      error.code === "invalid_session")
  );
}

export function isForbiddenApiError(error: unknown) {
  return isApiClientError(error) && error.status === 403;
}

export function isNotFoundApiError(error: unknown) {
  return (
    isApiClientError(error) &&
    (error.status === 404 || error.code === "resource_not_found")
  );
}

export function isConflictApiError(error: unknown) {
  return (
    isApiClientError(error) &&
    (error.status === 409 ||
      error.status === 412 ||
      error.code === "conflict" ||
      error.code === "precondition_failed" ||
      error.code === "stale_write" ||
      error.code === "replay_conflict" ||
      error.code === "idempotency_conflict")
  );
}

export function getApiClientErrorMessage(error: unknown, fallback: string) {
  if (isApiClientError(error) && error.message) {
    return error.message;
  }

  return fallback;
}

export function buildApiUrl(path: string) {
  return new URL(path, env.apiBaseUrl).toString();
}

export async function apiFetch<TData>(
  path: string,
  init: RequestInit = {}
): Promise<TData> {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      credentials: "include",
    });
  } catch (error) {
    throw createNetworkError(error);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw createApiClientError(response, payload);
  }

  if (isApiEnvelope<TData>(payload)) {
    if (!payload.success) {
      throw createApiClientError(response, payload);
    }

    return payload.data;
  }

  return payload as TData;
}

export async function apiMutation<TData>(
  path: string,
  init: RequestInit = {}
): Promise<TData> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  return apiFetch<TData>(path, {
    ...init,
    headers,
  });
}