import runtime from "./runtime.js";

type RequestWithHeaders = {
  headers?: Headers | Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
  correlationId?: string;
};

type ResponseWithHeaders = {
  headers?: Headers;
  setHeader?: (name: string, value: string) => void;
};

interface CorrelationRuntime {
  CORRELATION_ID_HEADER: string;
  getOrCreateCorrelationId: (request?: RequestWithHeaders) => string;
  attachCorrelationId: <T extends ResponseWithHeaders>(response: T, correlationId: string) => T;
}

const correlationRuntime = runtime as CorrelationRuntime;

export const CORRELATION_ID_HEADER = correlationRuntime.CORRELATION_ID_HEADER;

export function getOrCreateCorrelationId(request?: RequestWithHeaders) {
  return correlationRuntime.getOrCreateCorrelationId(request);
}

export function attachCorrelationId<T extends ResponseWithHeaders>(
  response: T,
  correlationId: string
) {
  return correlationRuntime.attachCorrelationId(response, correlationId);
}