export type PublicRuntimeStatus =
  | "healthy"
  | "degraded"
  | "incompatible"
  | "startup-failed";

export interface PublicRuntimeIssue {
  code: string;
  status: Exclude<PublicRuntimeStatus, "healthy">;
  boundary: "frontend_runtime" | "frontend_auth";
  message: string;
  details: Record<string, string>;
}

export interface PublicRuntimeEnv {
  apiBaseUrl: string;
  apiOrigin: string | null;
  authLoginUrl: string | null;
  authMeUrl: string | null;
  deploymentId: string;
  contractVersion: string;
  nodeEnv: string;
  isProduction: boolean;
  isDeployedRuntime: boolean;
}

export interface PublicRuntimeValidation {
  status: PublicRuntimeStatus;
  authRuntimeStatus: PublicRuntimeStatus;
  issues: PublicRuntimeIssue[];
}

const STATUS_PRIORITY: Record<PublicRuntimeStatus, number> = {
  healthy: 0,
  degraded: 1,
  incompatible: 2,
  "startup-failed": 3,
};

function readEnvValue(
  source: NodeJS.ProcessEnv,
  key: string,
  fallback: string
): string {
  return source[key] ?? fallback;
}

function normalizeUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeValue(value: string) {
  return value.trim() === "" ? "unknown" : value.trim();
}

function parseAbsoluteUrl(value: string) {
  try {
    const parsedUrl = new URL(value);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
}

function buildRuntimeUrl(baseUrl: string, pathname: string) {
  const parsedBaseUrl = parseAbsoluteUrl(baseUrl);

  if (!parsedBaseUrl) {
    return null;
  }

  return new URL(pathname, parsedBaseUrl).toString();
}

function isLoopbackHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function isPlaceholderDeploymentId(deploymentId: string) {
  return ["local-dev", "unknown"].includes(deploymentId);
}

function aggregateStatus(statuses: PublicRuntimeStatus[]) {
  return statuses.reduce<PublicRuntimeStatus>((resolvedStatus, status) => {
    return STATUS_PRIORITY[status] > STATUS_PRIORITY[resolvedStatus]
      ? status
      : resolvedStatus;
  }, "healthy");
}

function issue(
  code: string,
  status: Exclude<PublicRuntimeStatus, "healthy">,
  boundary: PublicRuntimeIssue["boundary"],
  message: string,
  details: Record<string, string>
): PublicRuntimeIssue {
  return {
    code,
    status,
    boundary,
    message,
    details,
  };
}

export function resolvePublicRuntimeEnv(
  source: NodeJS.ProcessEnv = process.env
): PublicRuntimeEnv {
  const apiBaseUrl = normalizeUrl(
    readEnvValue(source, "NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8003")
  );
  const parsedApiBaseUrl = parseAbsoluteUrl(apiBaseUrl);
  const deploymentId = normalizeValue(
    readEnvValue(
      source,
      "NEXT_PUBLIC_DEPLOYMENT_ID",
      readEnvValue(
        source,
        "NEXT_DEPLOYMENT_ID",
        readEnvValue(
          source,
          "CF_PAGES_COMMIT_SHA",
          readEnvValue(source, "SOURCE_VERSION", readEnvValue(source, "GIT_SHA", "local-dev"))
        )
      )
    )
  );
  const contractVersion = normalizeValue(
    readEnvValue(
      source,
      "NEXT_PUBLIC_CONTRACT_VERSION",
      readEnvValue(source, "CONTRACT_VERSION", "2026-05-21")
    )
  );
  const nodeEnv = readEnvValue(source, "NODE_ENV", "development");
  const isProduction = nodeEnv === "production";
  const isDeployedRuntime =
    isProduction &&
    parsedApiBaseUrl !== null &&
    !isLoopbackHost(parsedApiBaseUrl.hostname);

  return {
    apiBaseUrl,
    apiOrigin: parsedApiBaseUrl?.origin ?? null,
    authLoginUrl: buildRuntimeUrl(apiBaseUrl, "/v1/auth/login"),
    authMeUrl: buildRuntimeUrl(apiBaseUrl, "/v1/auth/me"),
    deploymentId,
    contractVersion,
    nodeEnv,
    isProduction,
    isDeployedRuntime,
  };
}

export function validatePublicRuntimeEnv(
  runtimeEnv: PublicRuntimeEnv
): PublicRuntimeValidation {
  const runtimeIssues: PublicRuntimeIssue[] = [];
  const authIssues: PublicRuntimeIssue[] = [];
  const parsedApiBaseUrl = parseAbsoluteUrl(runtimeEnv.apiBaseUrl);

  if (!parsedApiBaseUrl) {
    runtimeIssues.push(
      issue(
        "FE_API_BASE_URL_INVALID",
        "startup-failed",
        "frontend_runtime",
        "The frontend API base URL is not a valid absolute HTTP URL.",
        {
          apiBaseUrl: runtimeEnv.apiBaseUrl,
        }
      )
    );
    authIssues.push(
      issue(
        "FE_AUTH_URL_INVALID",
        "startup-failed",
        "frontend_auth",
        "The frontend cannot derive valid auth runtime URLs from the configured API origin.",
        {
          apiBaseUrl: runtimeEnv.apiBaseUrl,
        }
      )
    );
  }

  if (
    runtimeEnv.authLoginUrl === null ||
    runtimeEnv.authMeUrl === null ||
    parseAbsoluteUrl(runtimeEnv.authLoginUrl)?.origin !== runtimeEnv.apiOrigin ||
    parseAbsoluteUrl(runtimeEnv.authMeUrl)?.origin !== runtimeEnv.apiOrigin
  ) {
    authIssues.push(
      issue(
        "FE_AUTH_RUNTIME_ALIGNMENT_INVALID",
        "startup-failed",
        "frontend_auth",
        "The frontend auth URLs do not align with the configured backend API origin.",
        {
          apiBaseUrl: runtimeEnv.apiBaseUrl,
          authLoginUrl: runtimeEnv.authLoginUrl ?? "unknown",
          authMeUrl: runtimeEnv.authMeUrl ?? "unknown",
        }
      )
    );
  }

  if (parsedApiBaseUrl && runtimeEnv.isDeployedRuntime && parsedApiBaseUrl.protocol !== "https:") {
    runtimeIssues.push(
      issue(
        "FE_API_ORIGIN_INSECURE",
        "incompatible",
        "frontend_runtime",
        "A deployed frontend runtime must target an HTTPS backend origin.",
        {
          apiBaseUrl: runtimeEnv.apiBaseUrl,
        }
      )
    );
  }

  if (parsedApiBaseUrl && runtimeEnv.isProduction && isLoopbackHost(parsedApiBaseUrl.hostname)) {
    runtimeIssues.push(
      issue(
        "FE_LOCAL_LOOPBACK_RUNTIME",
        "degraded",
        "frontend_runtime",
        "The frontend build is running in production mode against a loopback backend origin.",
        {
          apiBaseUrl: runtimeEnv.apiBaseUrl,
        }
      )
    );
  }

  if (runtimeEnv.isDeployedRuntime && isPlaceholderDeploymentId(runtimeEnv.deploymentId)) {
    runtimeIssues.push(
      issue(
        "FE_DEPLOYMENT_ID_PLACEHOLDER",
        "incompatible",
        "frontend_runtime",
        "A deployed frontend runtime must expose stable deployment metadata for rollback safety.",
        {
          deploymentId: runtimeEnv.deploymentId,
        }
      )
    );
  }

  if (runtimeEnv.isDeployedRuntime && runtimeEnv.contractVersion === "unknown") {
    runtimeIssues.push(
      issue(
        "FE_CONTRACT_VERSION_UNKNOWN",
        "incompatible",
        "frontend_runtime",
        "A deployed frontend runtime must expose a concrete contract version.",
        {
          contractVersion: runtimeEnv.contractVersion,
        }
      )
    );
  }

  const authRuntimeStatus = aggregateStatus(authIssues.map(({ status }) => status));
  const status = aggregateStatus([
    ...runtimeIssues.map(({ status }) => status),
    authRuntimeStatus,
  ]);

  return {
    status,
    authRuntimeStatus,
    issues: [...runtimeIssues, ...authIssues],
  };
}

export function assertPublicRuntimeEnv(
  runtimeEnv: PublicRuntimeEnv = env,
  validation: PublicRuntimeValidation = publicRuntimeValidation
) {
  if (["incompatible", "startup-failed"].includes(validation.status)) {
    const issueCodes = validation.issues.map(({ code }) => code).join(", ");
    const runtimeConfigError = new Error(
      `Invalid frontend runtime configuration (${validation.status}) for ${runtimeEnv.apiBaseUrl}: ${issueCodes}`
    );

    runtimeConfigError.name = "RuntimeConfigError";

    throw runtimeConfigError;
  }

  return validation;
}

export const env = resolvePublicRuntimeEnv();

export const publicRuntimeValidation = validatePublicRuntimeEnv(env);
