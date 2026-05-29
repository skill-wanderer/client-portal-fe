import {
  assertPublicRuntimeEnv,
  resolvePublicRuntimeEnv,
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

  test("rejects a deployed runtime that still uses placeholder deployment metadata", () => {
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
      NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(validation.status).toBe("incompatible");
    expect(validation.issues[0]?.code).toBe("FE_DEPLOYMENT_ID_PLACEHOLDER");
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).toThrow(
      /FE_DEPLOYMENT_ID_PLACEHOLDER/
    );
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
});