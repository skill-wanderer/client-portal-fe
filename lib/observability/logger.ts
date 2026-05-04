import runtime from "./runtime.js";

export interface LogPayload {
  message: string;
  timestamp?: string;
  correlationId?: string;
  path?: string;
  method?: string;
  status?: number;
  duration?: number;
  error?: unknown;
}

interface LoggerRuntime {
  logInfo: (payload: LogPayload) => void;
  logWarn: (payload: LogPayload) => void;
  logError: (payload: LogPayload) => void;
}

const loggerRuntime = runtime as LoggerRuntime;

export function logInfo(payload: LogPayload) {
  loggerRuntime.logInfo(payload);
}

export function logWarn(payload: LogPayload) {
  loggerRuntime.logWarn(payload);
}

export function logError(payload: LogPayload) {
  loggerRuntime.logError(payload);
}