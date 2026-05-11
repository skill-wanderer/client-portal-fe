import { env } from "@/lib/env";

interface ApiErrorPayload {
  code: string;
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
  readonly code: string;
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

  if (status === 401) {
    return "unauthorized";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "not_found";
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