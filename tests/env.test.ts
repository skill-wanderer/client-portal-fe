import {
  assertPublicRuntimeEnv,
  resolvePublicRuntimeEnv,
  resolveRequestRuntimeUrl,
  validatePublicRuntimeEnv,
} from "@/lib/env";

describe("public runtime env validation", () => {
  test("accepts a deployed runtime with stable deployment metadata", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://client.skill-wanderer.com",
      NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
      NEXT_PUBLIC_OIDC_ISSUER:
        "https://sso.skill-wanderer.com/realms/skill-wanderer",
      NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
      NEXT_PUBLIC_OIDC_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/callback",
      NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/silent-callback",
      NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
        "https://client.skill-wanderer.com/login",
      NEXT_PUBLIC_DEPLOYMENT_ID: "fe-deploy-20260523",
      NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.appOrigin).toBe("https://client.skill-wanderer.com");
    expect(runtimeEnv.oidcRedirectUri).toBe(
      "https://client.skill-wanderer.com/auth/callback"
    );
    expect(validation.status).toBe("healthy");
    expect(validation.authRuntimeStatus).toBe("healthy");
    expect(validation.issues).toEqual([]);
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).not.toThrow();
  });

  test("uses the deployed frontend host as a stable production deployment fallback when metadata is omitted", () => {
    const runtimeEnv = resolvePublicRuntimeEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://client.skill-wanderer.com",
        NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
        NEXT_PUBLIC_OIDC_ISSUER:
          "https://sso.skill-wanderer.com/realms/skill-wanderer",
        NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
        NEXT_PUBLIC_OIDC_REDIRECT_URI:
          "https://client.skill-wanderer.com/auth/callback",
        NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
          "https://client.skill-wanderer.com/auth/silent-callback",
        NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
          "https://client.skill-wanderer.com/login",
        NEXT_PUBLIC_DEPLOYMENT_ID: "local-dev",
        NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
      },
      {
        requestUrl: "https://client.skill-wanderer.com/login",
      }
    );

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.deploymentId).toBe("client.skill-wanderer.com");
    expect(validation.status).toBe("healthy");
    expect(validation.issues).toEqual([]);
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).not.toThrow();
  });

  test("keeps local loopback builds diagnosable without blocking startup", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8003",
      NEXT_PUBLIC_OIDC_ISSUER: "http://127.0.0.1:8080/realms/skill-wanderer",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(validation.status).toBe("degraded");
    expect(validation.issues[0]?.code).toBe("FE_LOCAL_LOOPBACK_RUNTIME");
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).not.toThrow();
  });

  test("derives the deployed frontend origin from OIDC redirect URIs when NEXT_PUBLIC_APP_URL is omitted", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
      NEXT_PUBLIC_OIDC_ISSUER:
        "https://sso.skill-wanderer.com/realms/client-portal",
      NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
      NEXT_PUBLIC_OIDC_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/callback",
      NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/silent-callback",
      NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
        "https://client.skill-wanderer.com/login",
      NEXT_PUBLIC_DEPLOYMENT_ID: "fe-deploy-20260523",
      NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.appUrl).toBe("https://client.skill-wanderer.com");
    expect(runtimeEnv.appOrigin).toBe("https://client.skill-wanderer.com");
    expect(validation.status).toBe("healthy");
    expect(validation.issues).toEqual([]);
  });

  test("derives the deployed frontend origin from the request URL when available", () => {
    const requestHeaders = new Headers({
      host: "client.skill-wanderer.com",
      "x-forwarded-proto": "https",
    });
    const runtimeEnv = resolvePublicRuntimeEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
        NEXT_PUBLIC_OIDC_ISSUER:
          "https://sso.skill-wanderer.com/realms/client-portal",
        NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
        NEXT_PUBLIC_OIDC_REDIRECT_URI:
          "https://client.skill-wanderer.com/auth/callback",
        NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
          "https://client.skill-wanderer.com/auth/silent-callback",
        NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
          "https://client.skill-wanderer.com/login",
        NEXT_PUBLIC_DEPLOYMENT_ID: "fe-deploy-20260523",
        NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
      },
      {
        requestUrl: resolveRequestRuntimeUrl(requestHeaders),
      }
    );

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.appOrigin).toBe("https://client.skill-wanderer.com");
    expect(validation.status).toBe("healthy");
    expect(validation.issues).toEqual([]);
  });

  test("ignores baked public loopback values during deployed server resolution", () => {
    const runtimeEnv = resolvePublicRuntimeEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8003",
        NEXT_PUBLIC_OIDC_ISSUER:
          "http://127.0.0.1:8080/realms/skill-wanderer",
        NEXT_PUBLIC_OIDC_REDIRECT_URI:
          "http://127.0.0.1:3000/auth/callback",
        NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
          "http://127.0.0.1:3000/auth/silent-callback",
        NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
          "http://127.0.0.1:3000/login",
        OIDC_ISSUER: "https://sso.skill-wanderer.com/realms/client-portal",
        OIDC_CLIENT_ID: "client-portal-fe",
        NEXT_PUBLIC_DEPLOYMENT_ID: "local-dev",
        NEXT_DEPLOYMENT_ID: "cf-deploy-20260531",
        CONTRACT_VERSION: "contract-v1",
      },
      {
        requestUrl: "https://client.skill-wanderer.com/login",
      }
    );

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.appUrl).toBe("https://client.skill-wanderer.com");
    expect(runtimeEnv.apiBaseUrl).toBe("https://client.skill-wanderer.com");
    expect(runtimeEnv.oidcIssuer).toBe(
      "https://sso.skill-wanderer.com/realms/client-portal"
    );
    expect(runtimeEnv.oidcRedirectUri).toBe(
      "https://client.skill-wanderer.com/auth/callback"
    );
    expect(runtimeEnv.oidcSilentRedirectUri).toBe(
      "https://client.skill-wanderer.com/auth/silent-callback"
    );
    expect(runtimeEnv.oidcLogoutRedirectUri).toBe(
      "https://client.skill-wanderer.com/login"
    );
    expect(runtimeEnv.deploymentId).toBe("cf-deploy-20260531");
    expect(validation.status).toBe("healthy");
    expect(validation.issues).toEqual([]);
  });

  test("prefers runtime deployment metadata over a baked public placeholder", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://client.skill-wanderer.com",
      NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
      NEXT_PUBLIC_OIDC_ISSUER:
        "https://sso.skill-wanderer.com/realms/client-portal",
      NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
      NEXT_PUBLIC_OIDC_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/callback",
      NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/silent-callback",
      NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
        "https://client.skill-wanderer.com/login",
      NEXT_PUBLIC_DEPLOYMENT_ID: "local-dev",
      NEXT_DEPLOYMENT_ID: "cf-deploy-20260531",
      CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.deploymentId).toBe("cf-deploy-20260531");
    expect(runtimeEnv.contractVersion).toBe("contract-v1");
    expect(validation.status).toBe("healthy");
    expect(validation.issues).toEqual([]);
  });

  test("accepts server-side runtime aliases for API and OIDC config", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://client.skill-wanderer.com",
      API_BASE_URL: "https://api.skill-wanderer.com",
      OIDC_ISSUER: "https://sso.skill-wanderer.com/realms/client-portal",
      OIDC_CLIENT_ID: "client-portal-fe",
      OIDC_REDIRECT_URI: "https://client.skill-wanderer.com/auth/callback",
      OIDC_SILENT_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/silent-callback",
      OIDC_LOGOUT_REDIRECT_URI: "https://client.skill-wanderer.com/login",
      NEXT_DEPLOYMENT_ID: "cf-deploy-20260531",
      CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.apiBaseUrl).toBe("https://api.skill-wanderer.com");
    expect(runtimeEnv.oidcIssuer).toBe(
      "https://sso.skill-wanderer.com/realms/client-portal"
    );
    expect(runtimeEnv.oidcClientId).toBe("client-portal-fe");
    expect(validation.status).toBe("healthy");
    expect(validation.issues).toEqual([]);
  });

  test("defaults the deployed API base URL to the frontend origin when backend config is omitted", () => {
    const runtimeEnv = resolvePublicRuntimeEnv(
      {
        NODE_ENV: "production",
        NEXT_PUBLIC_OIDC_ISSUER:
          "https://sso.skill-wanderer.com/realms/client-portal",
        NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
        NEXT_PUBLIC_OIDC_REDIRECT_URI:
          "https://client.skill-wanderer.com/auth/callback",
        NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
          "https://client.skill-wanderer.com/auth/silent-callback",
        NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
          "https://client.skill-wanderer.com/login",
        NEXT_DEPLOYMENT_ID: "cf-deploy-20260531",
        CONTRACT_VERSION: "contract-v1",
      },
      {
        requestUrl: "https://client.skill-wanderer.com/login",
      }
    );

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.apiBaseUrl).toBe("https://client.skill-wanderer.com");
    expect(runtimeEnv.apiOrigin).toBe("https://client.skill-wanderer.com");
    expect(validation.status).toBe("healthy");
    expect(validation.issues).toEqual([]);
  });

  test("fails fast when the OIDC issuer is not a valid URL", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://client.skill-wanderer.com",
      NEXT_PUBLIC_API_BASE_URL: "not-a-url",
      NEXT_PUBLIC_OIDC_ISSUER: "not-a-url",
      NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
      NEXT_PUBLIC_OIDC_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/callback",
      NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/silent-callback",
      NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
        "https://client.skill-wanderer.com/login",
      NEXT_PUBLIC_DEPLOYMENT_ID: "fe-deploy-20260523",
      NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(validation.status).toBe("startup-failed");
    expect(validation.authRuntimeStatus).toBe("startup-failed");
    expect(validation.issues.map(({ code }) => code)).toContain(
      "FE_OIDC_ISSUER_INVALID"
    );
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).toThrow(
      /FE_OIDC_ISSUER_INVALID/
    );
  });

  test("logs raw issuer source values when a markdown-formatted issuer reaches validation", () => {
    const source: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      OIDC_ISSUER:
        "[https://sso.skill-wanderer.com/realms/client-portal](https://sso.skill-wanderer.com/realms/client-portal)",
      NEXT_PUBLIC_OIDC_ISSUER:
        "[https://sso.skill-wanderer.com/realms/client-portal](https://sso.skill-wanderer.com/realms/client-portal)",
      NEXT_PUBLIC_APP_URL: "https://client.skill-wanderer.com",
      NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
      NEXT_PUBLIC_OIDC_CLIENT_ID: "client-portal-fe",
      NEXT_PUBLIC_OIDC_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/callback",
      NEXT_PUBLIC_OIDC_SILENT_REDIRECT_URI:
        "https://client.skill-wanderer.com/auth/silent-callback",
      NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI:
        "https://client.skill-wanderer.com/login",
      NEXT_DEPLOYMENT_ID: "cf-deploy-20260602",
      CONTRACT_VERSION: "contract-v1",
    };
    const runtimeEnv = resolvePublicRuntimeEnv(source, {
      requestUrl: "https://client.skill-wanderer.com/login",
    });
    const validation = validatePublicRuntimeEnv(runtimeEnv);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() =>
      assertPublicRuntimeEnv(runtimeEnv, validation, {
        source,
        requestUrl: "https://client.skill-wanderer.com/login",
      })
    ).toThrow(/FE_OIDC_ISSUER_INVALID/);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const diagnosticRecord = JSON.parse(
      String(consoleErrorSpy.mock.calls[0]?.[0] ?? "{}")
    );

    expect(diagnosticRecord.issuer.resolvedValue).toBe(source.OIDC_ISSUER);
    expect(diagnosticRecord.issuer.resolvedSource).toBe("runtime:OIDC_ISSUER");
    expect(diagnosticRecord.issuer.rawRuntimeValueLooksLikeMarkdownLink).toBe(
      true
    );
    expect(diagnosticRecord.runtime.bindings.OIDC_ISSUER).toBe(true);
    expect(diagnosticRecord.runtime.bindings.NEXT_PUBLIC_OIDC_ISSUER).toBe(true);

    consoleErrorSpy.mockRestore();
  });
});