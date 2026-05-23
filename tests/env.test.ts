import {
  assertPublicRuntimeEnv,
  resolvePublicRuntimeEnv,
  validatePublicRuntimeEnv,
} from "@/lib/env";

describe("public runtime env validation", () => {
  test("accepts a deployed runtime with stable deployment metadata", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
      NEXT_PUBLIC_DEPLOYMENT_ID: "fe-deploy-20260523",
      NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(runtimeEnv.authLoginUrl).toBe(
      "https://api.skill-wanderer.com/v1/auth/login"
    );
    expect(runtimeEnv.authMeUrl).toBe("https://api.skill-wanderer.com/v1/auth/me");
    expect(validation.status).toBe("healthy");
    expect(validation.authRuntimeStatus).toBe("healthy");
    expect(validation.issues).toEqual([]);
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).not.toThrow();
  });

  test("rejects a deployed runtime that still uses placeholder deployment metadata", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_BASE_URL: "https://api.skill-wanderer.com",
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
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8003",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(validation.status).toBe("degraded");
    expect(validation.issues[0]?.code).toBe("FE_LOCAL_LOOPBACK_RUNTIME");
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).not.toThrow();
  });

  test("fails fast when the API origin is not a valid URL", () => {
    const runtimeEnv = resolvePublicRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_BASE_URL: "not-a-url",
      NEXT_PUBLIC_DEPLOYMENT_ID: "fe-deploy-20260523",
      NEXT_PUBLIC_CONTRACT_VERSION: "contract-v1",
    });

    const validation = validatePublicRuntimeEnv(runtimeEnv);

    expect(validation.status).toBe("startup-failed");
    expect(validation.authRuntimeStatus).toBe("startup-failed");
    expect(validation.issues[0]?.code).toBe("FE_API_BASE_URL_INVALID");
    expect(() => assertPublicRuntimeEnv(runtimeEnv, validation)).toThrow(
      /FE_API_BASE_URL_INVALID/
    );
  });
});