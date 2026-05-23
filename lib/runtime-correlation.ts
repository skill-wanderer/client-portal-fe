import type { RuntimeFailure } from "@/lib/runtime-failures";
import { env } from "@/lib/env";

const STORAGE_KEYS = {
  browserFlowId: "client-portal.browser-flow-id",
  currentCorrelationId: "client-portal.current-correlation-id",
  pendingAuthFlow: "client-portal.pending-auth-flow",
  lastBackendResponse: "client-portal.last-backend-response",
  lastRuntimeFailure: "client-portal.last-runtime-failure",
  pendingRuntimeReload: "client-portal.pending-runtime-reload",
  recentRuntimeReload: "client-portal.recent-runtime-reload",
} as const;

interface PendingAuthFlowContext {
  correlationId: string;
  authFlowId: string;
  createdAt: number;
}

interface PendingRuntimeReload {
  failureCode: string;
  correlationId: string;
  recoveryHint: string | null;
  requestedAt: number;
}

export interface BackendResponseMetadata {
  correlationId: string | null;
  requestId: string | null;
  deploymentId: string | null;
  contractVersion: string | null;
  capturedAt: number;
  runtimeSkewDetected: boolean;
}

const memoryState: {
  browserFlowId: string | null;
  currentCorrelationId: string | null;
  pendingAuthFlow: PendingAuthFlowContext | null;
  lastBackendResponse: BackendResponseMetadata | null;
  lastRuntimeFailure: RuntimeFailure | null;
  pendingRuntimeReload: PendingRuntimeReload | null;
  recentRuntimeReload: PendingRuntimeReload | null;
} = {
  browserFlowId: null,
  currentCorrelationId: null,
  pendingAuthFlow: null,
  lastBackendResponse: null,
  lastRuntimeFailure: null,
  pendingRuntimeReload: null,
  recentRuntimeReload: null,
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function generateRuntimeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `rt-${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
}

function readSessionValue(key: string) {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures. Correlation continuity should degrade gracefully.
  }
}

function removeSessionValue(key: string) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures. Correlation continuity should degrade gracefully.
  }
}

function readSessionJson<T>(key: string): T | null {
  const value = readSessionValue(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function writeSessionJson(key: string, value: unknown) {
  try {
    writeSessionValue(key, JSON.stringify(value));
  } catch {
    // Ignore serialization failures. Correlation continuity should degrade gracefully.
  }
}

export function getBrowserFlowId() {
  if (memoryState.browserFlowId) {
    return memoryState.browserFlowId;
  }

  const storedValue = readSessionValue(STORAGE_KEYS.browserFlowId);

  if (storedValue) {
    memoryState.browserFlowId = storedValue;
    return storedValue;
  }

  const browserFlowId = generateRuntimeId();
  memoryState.browserFlowId = browserFlowId;
  writeSessionValue(STORAGE_KEYS.browserFlowId, browserFlowId);

  return browserFlowId;
}

export function beginIntentCorrelation() {
  const correlationId = generateRuntimeId();

  memoryState.currentCorrelationId = correlationId;
  writeSessionValue(STORAGE_KEYS.currentCorrelationId, correlationId);

  return correlationId;
}

export function ensureCorrelationId(correlationId?: string | null) {
  if (correlationId && correlationId.trim() !== "") {
    const normalizedValue = correlationId.trim();

    memoryState.currentCorrelationId = normalizedValue;
    writeSessionValue(STORAGE_KEYS.currentCorrelationId, normalizedValue);

    return normalizedValue;
  }

  if (memoryState.currentCorrelationId) {
    return memoryState.currentCorrelationId;
  }

  const storedValue = readSessionValue(STORAGE_KEYS.currentCorrelationId);

  if (storedValue) {
    memoryState.currentCorrelationId = storedValue;
    return storedValue;
  }

  return beginIntentCorrelation();
}

export function beginAuthRedirectFlow() {
  const correlationId = beginIntentCorrelation();
  const authFlowId = generateRuntimeId();
  const pendingContext = {
    correlationId,
    authFlowId,
    createdAt: Date.now(),
  } satisfies PendingAuthFlowContext;

  memoryState.pendingAuthFlow = pendingContext;
  writeSessionJson(STORAGE_KEYS.pendingAuthFlow, pendingContext);

  return pendingContext;
}

export function beginAuthRecoveryFlow() {
  const pendingContext = getPendingAuthRedirectFlow();

  if (pendingContext) {
    ensureCorrelationId(pendingContext.correlationId);
    return pendingContext;
  }

  return beginAuthRedirectFlow();
}

export function prepareAuthBootstrapContext() {
  const pendingContext = getPendingAuthRedirectFlow();

  if (pendingContext) {
    ensureCorrelationId(pendingContext.correlationId);
    return pendingContext;
  }

  return {
    correlationId: beginIntentCorrelation(),
    authFlowId: null,
    createdAt: Date.now(),
  };
}

export function getPendingAuthRedirectFlow() {
  if (memoryState.pendingAuthFlow) {
    return memoryState.pendingAuthFlow;
  }

  const storedValue = readSessionJson<PendingAuthFlowContext>(STORAGE_KEYS.pendingAuthFlow);

  if (!storedValue) {
    return null;
  }

  memoryState.pendingAuthFlow = storedValue;
  return storedValue;
}

export function clearPendingAuthRedirectFlow() {
  memoryState.pendingAuthFlow = null;
  removeSessionValue(STORAGE_KEYS.pendingAuthFlow);
}

export function recordRuntimeFailure(failure: RuntimeFailure) {
  memoryState.lastRuntimeFailure = failure;
  writeSessionJson(STORAGE_KEYS.lastRuntimeFailure, failure);
}

export function getLastRuntimeFailure() {
  if (memoryState.lastRuntimeFailure) {
    return memoryState.lastRuntimeFailure;
  }

  const storedValue = readSessionJson<RuntimeFailure>(STORAGE_KEYS.lastRuntimeFailure);

  if (!storedValue) {
    return null;
  }

  memoryState.lastRuntimeFailure = storedValue;
  return storedValue;
}

export function clearRuntimeFailure() {
  memoryState.lastRuntimeFailure = null;
  removeSessionValue(STORAGE_KEYS.lastRuntimeFailure);
}

function getRecentRuntimeReload() {
  if (memoryState.recentRuntimeReload) {
    return memoryState.recentRuntimeReload;
  }

  const storedValue = readSessionJson<PendingRuntimeReload>(
    STORAGE_KEYS.recentRuntimeReload
  );

  if (!storedValue) {
    return null;
  }

  memoryState.recentRuntimeReload = storedValue;
  return storedValue;
}

export function scheduleControlledRuntimeReload(options: {
  failureCode: string;
  correlationId?: string | null;
  recoveryHint?: string | null;
}) {
  if (typeof window === "undefined") {
    return false;
  }

  const recentReload = getRecentRuntimeReload();

  if (recentReload && Date.now() - recentReload.requestedAt < 60_000) {
    return false;
  }

  const pendingReload = {
    failureCode: options.failureCode,
    correlationId: ensureCorrelationId(options.correlationId),
    recoveryHint: options.recoveryHint ?? null,
    requestedAt: Date.now(),
  } satisfies PendingRuntimeReload;

  memoryState.pendingRuntimeReload = pendingReload;
  memoryState.recentRuntimeReload = pendingReload;
  writeSessionJson(STORAGE_KEYS.pendingRuntimeReload, pendingReload);
  writeSessionJson(STORAGE_KEYS.recentRuntimeReload, pendingReload);

  window.location.reload();

  return true;
}

export function consumePendingRuntimeReload() {
  const pendingReload =
    memoryState.pendingRuntimeReload ??
    readSessionJson<PendingRuntimeReload>(STORAGE_KEYS.pendingRuntimeReload);

  memoryState.pendingRuntimeReload = null;
  removeSessionValue(STORAGE_KEYS.pendingRuntimeReload);

  return pendingReload ?? null;
}

export function captureBackendResponseMetadata(headers: Headers) {
  const metadata = {
    correlationId: headers.get("X-Correlation-ID"),
    requestId: headers.get("X-Request-ID"),
    deploymentId: headers.get("X-Deployment-ID"),
    contractVersion: headers.get("X-Contract-Version"),
    capturedAt: Date.now(),
    runtimeSkewDetected:
      (headers.get("X-Deployment-ID") ?? env.deploymentId) !== env.deploymentId ||
      (headers.get("X-Contract-Version") ?? env.contractVersion) !== env.contractVersion,
  } satisfies BackendResponseMetadata;

  memoryState.lastBackendResponse = metadata;
  writeSessionJson(STORAGE_KEYS.lastBackendResponse, metadata);

  return metadata;
}

export function getLastBackendResponseMetadata() {
  if (memoryState.lastBackendResponse) {
    return memoryState.lastBackendResponse;
  }

  const storedValue = readSessionJson<BackendResponseMetadata>(STORAGE_KEYS.lastBackendResponse);

  if (!storedValue) {
    return null;
  }

  memoryState.lastBackendResponse = storedValue;
  return storedValue;
}

export function getRuntimeCorrelationMetadata() {
  return {
    browserFlowId: getBrowserFlowId(),
    correlationId: ensureCorrelationId(),
    deploymentId: env.deploymentId,
    contractVersion: env.contractVersion,
  };
}