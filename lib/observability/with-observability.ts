import { NextResponse } from "next/server";
import { isForbiddenRoleError } from "@/lib/auth/rbac";
import {
  attachCorrelationId,
  getOrCreateCorrelationId,
} from "@/lib/observability/correlation";
import {
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability/logger";

interface ObservabilityOptions {
  method: string;
  route: string;
}

type RouteHandler<TArgs extends unknown[]> = (...args: TArgs) => Promise<Response> | Response;

function isRequestLike(value: unknown): value is Request & { nextUrl?: URL } {
  return (
    typeof value === "object" &&
    value !== null &&
    "headers" in value &&
    "url" in value
  );
}

function getRequestPath(request: (Request & { nextUrl?: URL }) | undefined, fallbackPath: string) {
  if (!request) {
    return fallbackPath;
  }

  if (request.nextUrl?.pathname) {
    return request.nextUrl.pathname;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return fallbackPath;
  }
}

function logResponse(
  status: number,
  correlationId: string,
  method: string,
  path: string,
  duration: number
) {
  const payload = {
    message: "request_complete",
    correlationId,
    method,
    path,
    status,
    duration,
  };

  if (status >= 500) {
    logError(payload);
    return;
  }

  if (status >= 400) {
    logWarn(payload);
    return;
  }

  logInfo(payload);
}

export function withObservability<TArgs extends unknown[]>(
  handler: RouteHandler<TArgs>,
  options: ObservabilityOptions
) {
  return async (...args: TArgs): Promise<Response> => {
    const request = isRequestLike(args[0]) ? args[0] : undefined;
    const correlationId = getOrCreateCorrelationId(request);
    const method = request?.method ?? options.method;
    const path = getRequestPath(request, options.route);
    const startedAt = Date.now();

    logInfo({
      message: "request_start",
      correlationId,
      method,
      path,
    });

    try {
      const response = await handler(...args);
      attachCorrelationId(response, correlationId);
      logResponse(response.status, correlationId, method, path, Date.now() - startedAt);
      return response;
    } catch (error) {
      if (isForbiddenRoleError(error)) {
        const response = NextResponse.json(
          { error: "forbidden", reason: error.reason },
          { status: error.status }
        );
        attachCorrelationId(response, correlationId);

        logWarn({
          message: "request_forbidden",
          correlationId,
          method,
          path,
          status: error.status,
          duration: Date.now() - startedAt,
          error,
        });

        return response;
      }

      const response = NextResponse.json({ error: "internal_error" }, { status: 500 });
      attachCorrelationId(response, correlationId);

      logError({
        message: "request_error",
        correlationId,
        method,
        path,
        status: 500,
        duration: Date.now() - startedAt,
        error,
      });

      return response;
    }
  };
}