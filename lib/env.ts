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
  appUrl: string;
  appOrigin: string | null;
  apiBaseUrl: string;
  apiOrigin: string | null;
  oidcIssuer: string;
  oidcClientId: string;
  oidcRedirectUri: string;
  oidcSilentRedirectUri: string;
  oidcLogoutRedirectUri: string;
  oidcScope: string;
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

export interface PublicRuntimeEnvResolveOptions {
  requestUrl?: string | URL | null;
}

const STATUS_PRIORITY: Record<PublicRuntimeStatus, number> = {
  healthy: 0,
  degraded: 1,
  incompatible: 2,
  "startup-failed": 3,
};

const LOCAL_DEV_APP_URL = "http://127.0.0.1:3000";
const LOCAL_DEV_API_BASE_URL = "http://127.0.0.1:8003";
const LOCAL_DEV_OIDC_ISSUER = "http://127.0.0.1:8080/realms/skill-wanderer";

const DEPLOYED_HOST_ENV_KEYS = [
  "CLOUDFLARE_PUBLIC_URL",
  "CF_PAGES_URL",
  "URL",
  "DEPLOYMENT_URL",
  "VERCEL_URL",
] as const;

const FRONTEND_REDIRECT_ENV_KEYS = [
  "NEXT_PUBLIC_OIDC_REDIRECT_URI",
  "NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI",
  "NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI",
] as const;

interface RuntimeHeaderLookup {
  get(name: string): string | null;
}

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

function readOptionalEnvValue(source: NodeJS.ProcessEnv, key: string) {
  const value = source[key];

  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
    return pathname;
  }

  return new URL(pathname, parsedBaseUrl).toString();
}

function normalizeRuntimeUrlCandidate(
  value: string | URL | null | undefined,
  options: {
    extractOrigin?: boolean;
    defaultProtocol?: "http:" | "https:";
  } = {}
) {
  if (!value) {
    return null;
  }

  const rawValue = value instanceof URL ? value.toString() : value;
  const trimmedValue = rawValue.trim();

  if (trimmedValue === "") {
    return null;
  }

  const parsedAbsoluteUrl = parseAbsoluteUrl(trimmedValue);

  if (parsedAbsoluteUrl) {
    return normalizeUrl(
      options.extractOrigin ? parsedAbsoluteUrl.origin : parsedAbsoluteUrl.toString()
    );
  }

  if (/^[a-z0-9.-]+(?::\d+)?$/i.test(trimmedValue)) {
    const defaultProtocol = options.defaultProtocol ?? "https:";
    const protocolQualifiedUrl = parseAbsoluteUrl(
      `${defaultProtocol}//${trimmedValue}`
    );

    if (protocolQualifiedUrl) {
      return normalizeUrl(
        options.extractOrigin
          ? protocolQualifiedUrl.origin
          : protocolQualifiedUrl.toString()
      );
    }
  }

  return null;
}

function readFirstRuntimeUrlCandidate(
  values: Array<string | URL | null | undefined>,
  options: {
    extractOrigin?: boolean;
    defaultProtocol?: "http:" | "https:";
  } = {}
) {
  for (const value of values) {
    const resolvedValue = normalizeRuntimeUrlCandidate(value, options);

    if (resolvedValue) {
      return resolvedValue;
    }
  }

  return null;
}

export function resolveRequestRuntimeUrl(headers: RuntimeHeaderLookup) {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? null;
  const host = forwardedHost ?? headers.get("host")?.split(",")[0]?.trim() ?? null;
  const forwardedProto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() ?? null;

  if (!host) {
    return null;
  }

  const protocol: "http:" | "https:" =
    forwardedProto === "http"
      ? "http:"
      : forwardedProto === "https"
        ? "https:"
        : isLoopbackHost(host.replace(/:\d+$/, ""))
          ? "http:"
          : "https:";

  return normalizeRuntimeUrlCandidate(`${protocol}//${host}`, {
    extractOrigin: true,
    defaultProtocol: protocol,
  });
}

function resolveAppUrl(
  source: NodeJS.ProcessEnv,
  options: PublicRuntimeEnvResolveOptions
) {
  const explicitAppUrl = normalizeRuntimeUrlCandidate(
    readOptionalEnvValue(source, "NEXT_PUBLIC_APP_URL"),
    {
      extractOrigin: true,
    }
  );

  if (explicitAppUrl) {
    return explicitAppUrl;
  }

  const requestDerivedAppUrl = normalizeRuntimeUrlCandidate(options.requestUrl, {
    extractOrigin: true,
  });

  if (requestDerivedAppUrl) {
    return requestDerivedAppUrl;
  }

  const oidcDerivedAppUrl = readFirstRuntimeUrlCandidate(
    FRONTEND_REDIRECT_ENV_KEYS.map((key) => readOptionalEnvValue(source, key)),
    {
      extractOrigin: true,
    }
  );

  if (oidcDerivedAppUrl) {
    return oidcDerivedAppUrl;
  }

  const deployedHostAppUrl = readFirstRuntimeUrlCandidate(
    DEPLOYED_HOST_ENV_KEYS.map((key) => readOptionalEnvValue(source, key)),
    {
      extractOrigin: true,
      defaultProtocol: "https:",
    }
  );

  if (deployedHostAppUrl) {
    return deployedHostAppUrl;
  }

  return LOCAL_DEV_APP_URL;
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
  source: NodeJS.ProcessEnv = process.env,
  options: PublicRuntimeEnvResolveOptions = {}
): PublicRuntimeEnv {
  const appUrl = resolveAppUrl(source, options);
  const parsedAppUrl = parseAbsoluteUrl(appUrl);
  const apiBaseUrl = normalizeUrl(
    readEnvValue(source, "NEXT_PUBLIC_API_BASE_URL", LOCAL_DEV_API_BASE_URL)
  );
  const parsedApiBaseUrl = parseAbsoluteUrl(apiBaseUrl);
  const oidcIssuer = normalizeUrl(
    readEnvValue(
      source,
      "NEXT_PUBLIC_OIDC_ISSUER",
      LOCAL_DEV_OIDC_ISSUER
    )
  );
  const oidcClientId = normalizeValue(
    readEnvValue(source, "NEXT_PUBLIC_OIDC_CLIENT_ID", "client-portal-fe")
  );
  const oidcRedirectUri = normalizeUrl(
    readEnvValue(
      source,
      "NEXT_PUBLIC_OIDC_REDIRECT_URI",
      buildRuntimeUrl(appUrl, "/auth/callback")
    )
  );
  const oidcSilentRedirectUri = normalizeUrl(
    readEnvValue(
      source,
      "NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI",
      buildRuntimeUrl(appUrl, "/auth/silent-callback")
    )
  );
  const oidcLogoutRedirectUri = normalizeUrl(
    readEnvValue(
      source,
      "NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI",
      buildRuntimeUrl(appUrl, "/login")
    )
  );
  const oidcScope = normalizeValue(
    readEnvValue(source, "NEXT_PUBLIC_OIDC_SCOPE", "openid profile email")
  );
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
    parsedAppUrl !== null &&
    !isLoopbackHost(parsedAppUrl.hostname);

  return {
    appUrl,
    appOrigin: parsedAppUrl?.origin ?? null,
    apiBaseUrl,
    apiOrigin: parsedApiBaseUrl?.origin ?? null,
    oidcIssuer,
    oidcClientId,
    oidcRedirectUri,
    oidcSilentRedirectUri,
    oidcLogoutRedirectUri,
    oidcScope,
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
  const parsedAppUrl = parseAbsoluteUrl(runtimeEnv.appUrl);
  const parsedApiBaseUrl = parseAbsoluteUrl(runtimeEnv.apiBaseUrl);
  const parsedOidcIssuer = parseAbsoluteUrl(runtimeEnv.oidcIssuer);
  const parsedOidcRedirectUri = parseAbsoluteUrl(runtimeEnv.oidcRedirectUri);
  const parsedOidcSilentRedirectUri = parseAbsoluteUrl(
    runtimeEnv.oidcSilentRedirectUri
  );
  const parsedOidcLogoutRedirectUri = parseAbsoluteUrl(
    runtimeEnv.oidcLogoutRedirectUri
  );

  if (!parsedAppUrl) {
    runtimeIssues.push(
      issue(
        "FE_APP_URL_INVALID",
        "startup-failed",
        "frontend_runtime",
        "The frontend app URL is not a valid absolute HTTP URL.",
        {
          appUrl: runtimeEnv.appUrl,
        }
      )
    );
  }

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
  }

  if (
    runtimeEnv.oidcClientId === "unknown" ||
    runtimeEnv.oidcScope === "unknown"
  ) {
    authIssues.push(
      issue(
        "FE_OIDC_CLIENT_CONFIG_INVALID",
        "startup-failed",
        "frontend_auth",
        "The frontend OIDC client configuration is incomplete.",
        {
          oidcClientId: runtimeEnv.oidcClientId,
          oidcScope: runtimeEnv.oidcScope,
        }
      )
    );
  }

  if (!parsedOidcIssuer) {
    authIssues.push(
      issue(
        "FE_OIDC_ISSUER_INVALID",
        "startup-failed",
        "frontend_auth",
        "The configured OIDC issuer is not a valid absolute HTTP URL.",
        {
          oidcIssuer: runtimeEnv.oidcIssuer,
        }
      )
    );
  }

  if (!parsedOidcRedirectUri || !parsedOidcSilentRedirectUri || !parsedOidcLogoutRedirectUri) {
    authIssues.push(
      issue(
        "FE_OIDC_REDIRECT_URI_INVALID",
        "startup-failed",
        "frontend_auth",
        "The frontend OIDC redirect URIs must be valid absolute HTTP URLs.",
        {
          oidcRedirectUri: runtimeEnv.oidcRedirectUri,
          oidcSilentRedirectUri: runtimeEnv.oidcSilentRedirectUri,
          oidcLogoutRedirectUri: runtimeEnv.oidcLogoutRedirectUri,
        }
      )
    );
  }

  if (
    parsedAppUrl &&
    ((parsedOidcRedirectUri && parsedOidcRedirectUri.origin !== parsedAppUrl.origin) ||
      (parsedOidcSilentRedirectUri &&
        parsedOidcSilentRedirectUri.origin !== parsedAppUrl.origin) ||
      (parsedOidcLogoutRedirectUri &&
        parsedOidcLogoutRedirectUri.origin !== parsedAppUrl.origin))
  ) {
    authIssues.push(
      issue(
        "FE_OIDC_REDIRECT_ORIGIN_INVALID",
        "startup-failed",
        "frontend_auth",
        "The frontend OIDC redirect URIs must remain on the frontend origin.",
        {
          appOrigin: runtimeEnv.appOrigin ?? "unknown",
          oidcRedirectUri: runtimeEnv.oidcRedirectUri,
          oidcSilentRedirectUri: runtimeEnv.oidcSilentRedirectUri,
          oidcLogoutRedirectUri: runtimeEnv.oidcLogoutRedirectUri,
        }
      )
    );
  }

  if (parsedAppUrl && runtimeEnv.isDeployedRuntime && parsedAppUrl.protocol !== "https:") {
    runtimeIssues.push(
      issue(
        "FE_APP_ORIGIN_INSECURE",
        "incompatible",
        "frontend_runtime",
        "A deployed frontend runtime must expose an HTTPS app origin.",
        {
          appUrl: runtimeEnv.appUrl,
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

  if (parsedOidcIssuer && runtimeEnv.isDeployedRuntime && parsedOidcIssuer.protocol !== "https:") {
    authIssues.push(
      issue(
        "FE_OIDC_ISSUER_INSECURE",
        "incompatible",
        "frontend_auth",
        "A deployed frontend runtime must target an HTTPS OIDC issuer.",
        {
          oidcIssuer: runtimeEnv.oidcIssuer,
        }
      )
    );
  }

  if (
    runtimeEnv.isProduction &&
    ((parsedAppUrl && isLoopbackHost(parsedAppUrl.hostname)) ||
      (parsedApiBaseUrl && isLoopbackHost(parsedApiBaseUrl.hostname)) ||
      (parsedOidcIssuer && isLoopbackHost(parsedOidcIssuer.hostname)))
  ) {
    runtimeIssues.push(
      issue(
        "FE_LOCAL_LOOPBACK_RUNTIME",
        "degraded",
        "frontend_runtime",
        "The frontend build is running in production mode against loopback runtime dependencies.",
        {
          appUrl: runtimeEnv.appUrl,
          apiBaseUrl: runtimeEnv.apiBaseUrl,
          oidcIssuer: runtimeEnv.oidcIssuer,
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
      `Invalid frontend runtime configuration (${validation.status}) for ${runtimeEnv.appUrl}: ${issueCodes}`
    );

    runtimeConfigError.name = "RuntimeConfigError";

    throw runtimeConfigError;
  }

  return validation;
}

export const env = resolvePublicRuntimeEnv();

export const publicRuntimeValidation = validatePublicRuntimeEnv(env);
