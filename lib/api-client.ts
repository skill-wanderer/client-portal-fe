import { env } from "@/lib/env";
import { getActiveAccessToken } from "@/lib/oidc";
import {
  beginIntentCorrelation,
  captureBackendResponseMetadata,
  ensureCorrelationId,
  recordRuntimeFailure,
  scheduleControlledRuntimeReload,
} from "@/lib/runtime-correlation";
import {
  BACKEND_FAILURE_CODES,
  FRONTEND_FAILURE_CODES,
  shouldAutoRetrySafeRequest,
  shouldTriggerRuntimeReload,
  type RuntimeFailure,
} from "@/lib/runtime-failures";

export type ApiErrorCode = string;

interface ApiRequestInit extends RequestInit {
  correlationId?: string | null;
  timeoutMs?: number;
}

interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  failure_code?: string;
  recovery_hint?: string;
  retryable?: boolean;
  runtime_boundary?: string;
  reason?: string;
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
  correlation_id?: string | null;
  request_id?: string | null;
  deployment_id?: string | null;
  contract_version?: string | null;
}

type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiFailureEnvelope;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly deploymentId: string | null;
  readonly contractVersion: string | null;
  readonly failureCode: string | null;
  readonly recoveryHint: string | null;
  readonly retryable: boolean;
  readonly runtimeBoundary: string | null;
  readonly mutationId: string | null;
  readonly replayGroupId: string | null;
  readonly idempotentReplay: boolean;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    correlationId?: string | null;
    requestId?: string | null;
    deploymentId?: string | null;
    contractVersion?: string | null;
    failureCode?: string | null;
    recoveryHint?: string | null;
    retryable?: boolean;
    runtimeBoundary?: string | null;
    mutationId?: string | null;
    replayGroupId?: string | null;
    idempotentReplay?: boolean;
  }) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.correlationId = options.correlationId ?? null;
    this.requestId = options.requestId ?? null;
    this.deploymentId = options.deploymentId ?? null;
    this.contractVersion = options.contractVersion ?? null;
    this.failureCode = options.failureCode ?? null;
    this.recoveryHint = options.recoveryHint ?? null;
    this.retryable = options.retryable ?? false;
    this.runtimeBoundary = options.runtimeBoundary ?? null;
    this.mutationId = options.mutationId ?? null;
    this.replayGroupId = options.replayGroupId ?? null;
    this.idempotentReplay = options.idempotentReplay ?? false;
  }
}

function normalizeValue(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function getEnvelopeMetadataValue(
  payload: unknown,
  key: "correlation_id" | "request_id" | "deployment_id" | "contract_version"
) {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return null;
  }

  return normalizeValue(payload[key as keyof typeof payload]);
}

function isSafeMethod(method: string) {
  return ["GET", "HEAD"].includes(method.toUpperCase());
}

function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
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

function toRuntimeFailure(error: ApiClientError): RuntimeFailure {
  return {
    code: error.code,
    message: error.message,
    failureCode: error.failureCode ?? error.code,
    correlationId: error.correlationId,
    requestId: error.requestId,
    deploymentId: error.deploymentId,
    contractVersion: error.contractVersion,
    recoveryHint: error.recoveryHint,
    retryable: error.retryable,
    runtimeBoundary: error.runtimeBoundary ?? "frontend_runtime",
    mutationId: error.mutationId,
    replayGroupId: error.replayGroupId,
    idempotentReplay: error.idempotentReplay,
    status: error.status,
    capturedAt: Date.now(),
  };
}

function handleRuntimeFailure(error: ApiClientError) {
  recordRuntimeFailure(toRuntimeFailure(error));

  if (shouldTriggerRuntimeReload(error.failureCode)) {
    scheduleControlledRuntimeReload({
      failureCode: error.failureCode ?? FRONTEND_FAILURE_CODES.FE_RUNTIME_SKEW,
      correlationId: error.correlationId,
      recoveryHint: error.recoveryHint,
    });
  }

  return error;
}

export function getApiClientRuntimeFailure(error: unknown): RuntimeFailure | null {
  return isApiClientError(error) ? toRuntimeFailure(error) : null;
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

function getFailureCode(status: number, payload: unknown) {
  if (isApiEnvelope(payload) && payload.error?.failure_code) {
    return payload.error.failure_code;
  }

  if (
    status === 409 &&
    isApiEnvelope(payload) &&
    payload.error?.reason === "STALE_WRITE"
  ) {
    return BACKEND_FAILURE_CODES.BE_MUTATION_STALE_WRITE;
  }

  if (status === 409) {
    return BACKEND_FAILURE_CODES.BE_IDEMPOTENCY_CONFLICT;
  }

  if (status === 401) {
    return BACKEND_FAILURE_CODES.BE_SESSION_EXPIRED;
  }

  if (status === 412) {
    return BACKEND_FAILURE_CODES.BE_DEPLOYMENT_SKEW;
  }

  return null;
}

function getRecoveryHint(payload: unknown, failureCode: string | null) {
  if (isApiEnvelope(payload) && payload.error?.recovery_hint) {
    return payload.error.recovery_hint;
  }

  if (
    failureCode === BACKEND_FAILURE_CODES.BE_MUTATION_STALE_WRITE ||
    failureCode === BACKEND_FAILURE_CODES.BE_IDEMPOTENCY_CONFLICT
  ) {
    return "confirm_state_before_retry";
  }

  if (failureCode === BACKEND_FAILURE_CODES.BE_DEPLOYMENT_SKEW) {
    return "reload_runtime";
  }

  return null;
}

function getRetryable(payload: unknown, failureCode: string | null, status: number) {
  if (isApiEnvelope(payload) && typeof payload.error?.retryable === "boolean") {
    return payload.error.retryable;
  }

  if (
    failureCode === BACKEND_FAILURE_CODES.BE_SESSION_LOOKUP_FAILED ||
    failureCode === BACKEND_FAILURE_CODES.BE_KEYCLOAK_UNAVAILABLE ||
    failureCode === BACKEND_FAILURE_CODES.BE_DEPLOYMENT_SKEW
  ) {
    return true;
  }

  return status >= 500;
}

function getRuntimeBoundary(payload: unknown) {
  if (isApiEnvelope(payload) && payload.error?.runtime_boundary) {
    return payload.error.runtime_boundary;
  }

  return "backend_runtime";
}

function getErrorMessage(status: number, payload: unknown) {
  if (isApiEnvelope(payload) && payload.error?.message) {
    return payload.error.message;
  }

  if (status === 401) {
    return "Your sign-in session is no longer valid.";
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

function handleBackendMetadata(
  correlationId: string,
  metadata: ReturnType<typeof captureBackendResponseMetadata>
) {
  if (!metadata.runtimeSkewDetected) {
    return;
  }

  const runtimeFailure = {
    code: "runtime_skew",
    message: "The frontend and backend deployments are out of sync.",
    failureCode: FRONTEND_FAILURE_CODES.FE_DEPLOYMENT_MISMATCH,
    correlationId: metadata.correlationId ?? correlationId,
    requestId: metadata.requestId,
    deploymentId: metadata.deploymentId,
    contractVersion: metadata.contractVersion,
    recoveryHint: "reload_runtime",
    retryable: true,
    runtimeBoundary: "frontend_runtime",
    mutationId: null,
    replayGroupId: null,
    idempotentReplay: false,
    status: 0,
    capturedAt: Date.now(),
  } satisfies RuntimeFailure;

  recordRuntimeFailure(runtimeFailure);
  scheduleControlledRuntimeReload({
    failureCode: FRONTEND_FAILURE_CODES.FE_DEPLOYMENT_MISMATCH,
    correlationId: runtimeFailure.correlationId,
    recoveryHint: runtimeFailure.recoveryHint,
  });
}

function createApiClientError(response: Response, payload: unknown) {
  const failureCode = getFailureCode(response.status, payload);
  const metadata = captureBackendResponseMetadata(response.headers);

  handleBackendMetadata(response.headers.get("X-Correlation-ID") ?? "", metadata);

  return handleRuntimeFailure(
    new ApiClientError({
      message: getErrorMessage(response.status, payload),
      status: response.status,
      code: getErrorCode(response.status, payload),
      correlationId:
        response.headers.get("X-Correlation-ID") ??
        getEnvelopeMetadataValue(payload, "correlation_id"),
      requestId:
        response.headers.get("X-Request-ID") ??
        getEnvelopeMetadataValue(payload, "request_id"),
      deploymentId:
        response.headers.get("X-Deployment-ID") ??
        getEnvelopeMetadataValue(payload, "deployment_id"),
      contractVersion:
        response.headers.get("X-Contract-Version") ??
        getEnvelopeMetadataValue(payload, "contract_version"),
      failureCode,
      recoveryHint: getRecoveryHint(payload, failureCode),
      retryable: getRetryable(payload, failureCode, response.status),
      runtimeBoundary: getRuntimeBoundary(payload),
      mutationId: response.headers.get("X-Mutation-ID"),
      replayGroupId: response.headers.get("X-Replay-Group-ID"),
      idempotentReplay: response.headers.get("X-Idempotent-Replay") === "true",
    })
  );
}

function createRequestFailureError(
  error: unknown,
  options: { correlationId: string; code: ApiErrorCode; method: string; path: string }
) {
  const failureCode = (() => {
    if (isBrowserOffline()) {
      return FRONTEND_FAILURE_CODES.FE_OFFLINE;
    }

    if (options.code === "request_aborted") {
      return FRONTEND_FAILURE_CODES.FE_API_ABORTED;
    }

    return FRONTEND_FAILURE_CODES.FE_API_TIMEOUT;
  })();

  const recoveryHint = (() => {
    if (failureCode === FRONTEND_FAILURE_CODES.FE_OFFLINE) {
      return "wait_for_network";
    }

    if (failureCode === FRONTEND_FAILURE_CODES.FE_API_ABORTED) {
      return "retry_if_still_needed";
    }

    if (isSafeMethod(options.method)) {
      return "retry_safe_request";
    }

    return "confirm_state_before_retry";
  })();

  return new ApiClientError({
    message:
      error instanceof Error
        ? error.message
        : "The backend request could not be completed.",
    status: 0,
    code: options.code,
    correlationId: options.correlationId,
    deploymentId: env.deploymentId,
    contractVersion: env.contractVersion,
    failureCode,
    recoveryHint,
    retryable:
      failureCode === FRONTEND_FAILURE_CODES.FE_OFFLINE ||
      (failureCode !== FRONTEND_FAILURE_CODES.FE_API_ABORTED &&
        isSafeMethod(options.method)),
    runtimeBoundary:
      failureCode === FRONTEND_FAILURE_CODES.FE_OFFLINE
        ? "browser_runtime"
        : "frontend_runtime",
  });
}

function createMissingAccessTokenError(correlationId: string) {
  return handleRuntimeFailure(
    new ApiClientError({
      message: "Your sign-in session is no longer valid.",
      status: 401,
      code: "no_session",
      correlationId,
      deploymentId: env.deploymentId,
      contractVersion: env.contractVersion,
      failureCode: FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
      recoveryHint: "start_login",
      retryable: false,
      runtimeBoundary: "frontend_auth",
    })
  );
}

function createUnexpectedResponseError(response: Response, correlationId: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const failureCode = contentType.includes("text/html")
    ? FRONTEND_FAILURE_CODES.FE_STALE_BUNDLE
    : FRONTEND_FAILURE_CODES.FE_RUNTIME_SKEW;

  return handleRuntimeFailure(
    new ApiClientError({
      message: "The portal runtime received an unexpected response shape.",
      status: response.status,
      code: "invalid_response_shape",
      correlationId,
      requestId: response.headers.get("X-Request-ID"),
      deploymentId: response.headers.get("X-Deployment-ID") ?? env.deploymentId,
      contractVersion:
        response.headers.get("X-Contract-Version") ?? env.contractVersion,
      failureCode,
      recoveryHint: "reload_runtime",
      retryable: true,
      runtimeBoundary: "frontend_runtime",
      mutationId: response.headers.get("X-Mutation-ID"),
      replayGroupId: response.headers.get("X-Replay-Group-ID"),
      idempotentReplay: response.headers.get("X-Idempotent-Replay") === "true",
    })
  );
}

function buildRequestSignal(init: ApiRequestInit) {
  if (init.signal === undefined && init.timeoutMs === undefined) {
    return {
      signal: undefined,
      cleanup() {
        return;
      },
      didTimeout() {
        return false;
      },
    };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  const abortWithReason = () => controller.abort();

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", abortWithReason, { once: true });
    }
  }

  if (typeof init.timeoutMs === "number" && init.timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, init.timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (init.signal) {
        init.signal.removeEventListener("abort", abortWithReason);
      }
    },
    didTimeout() {
      return timedOut;
    },
  };
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
      error.code === "invalid_session" ||
      error.failureCode === BACKEND_FAILURE_CODES.BE_SESSION_EXPIRED)
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
      error.code === "idempotency_conflict" ||
      error.failureCode === BACKEND_FAILURE_CODES.BE_MUTATION_STALE_WRITE ||
      error.failureCode === BACKEND_FAILURE_CODES.BE_IDEMPOTENCY_CONFLICT)
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
  init: ApiRequestInit = {}
): Promise<TData> {
  const {
    correlationId: providedCorrelationId,
    timeoutMs,
    headers: initialHeaders,
    signal,
    ...requestInit
  } = init;
  const correlationId = ensureCorrelationId(providedCorrelationId);
  const headers = new Headers(initialHeaders);
  const method = (requestInit.method ?? init.method ?? "GET").toUpperCase();
  const resolvedTimeoutMs =
    timeoutMs ?? (isSafeMethod(method) ? 15_000 : 20_000);
  let response: Response | null = null;
  const accessToken = await getActiveAccessToken();

  headers.set("X-Correlation-ID", correlationId);
  headers.set("X-Deployment-ID", env.deploymentId);
  headers.set("X-Contract-Version", env.contractVersion);

  if (!headers.has("Authorization")) {
    if (!accessToken) {
      throw createMissingAccessTokenError(correlationId);
    }

    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  for (let attempt = 0; attempt <= 1; attempt += 1) {
    const requestSignal = buildRequestSignal({
      ...init,
      headers: initialHeaders,
      signal,
      timeoutMs: resolvedTimeoutMs,
    });

    try {
      response = await fetch(buildApiUrl(path), {
        ...requestInit,
        headers,
        signal: requestSignal.signal,
      });
      requestSignal.cleanup();
      break;
    } catch (error) {
      requestSignal.cleanup();

      const requestFailure = createRequestFailureError(error, {
        correlationId,
        code:
          error instanceof DOMException && error.name === "AbortError"
            ? requestSignal.didTimeout()
              ? "request_timeout"
              : "request_aborted"
            : "network_error",
        method,
        path,
      });

      if (shouldAutoRetrySafeRequest(method, toRuntimeFailure(requestFailure), attempt)) {
        continue;
      }

      throw handleRuntimeFailure(requestFailure);
    }
  }

  if (!response) {
    throw handleRuntimeFailure(
      createRequestFailureError(new Error("The backend response was unavailable."), {
        correlationId,
        code: "network_error",
        method,
        path,
      })
    );
  }

  const metadata = captureBackendResponseMetadata(response.headers);
  handleBackendMetadata(correlationId, metadata);

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

  throw createUnexpectedResponseError(response, correlationId);
}

export async function apiMutation<TData>(
  path: string,
  init: ApiRequestInit = {}
): Promise<TData> {
  const headers = new Headers(init.headers);
  const correlationId = init.correlationId ?? beginIntentCorrelation();

  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  return apiFetch<TData>(path, {
    ...init,
    correlationId,
    headers,
    timeoutMs: init.timeoutMs ?? 20_000,
  });
}
