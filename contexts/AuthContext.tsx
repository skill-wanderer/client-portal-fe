"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "oidc-client-ts";
import { env } from "@/lib/env";
import {
  type OidcProfile,
  cleanupOidcBrowserState,
  getOidcUserManager,
  isOidcCallbackPath,
  isOidcSilentCallbackPath,
  logoutOidcSession,
  recoverOidcSession,
  refreshOidcUser,
  startOidcLogin,
  tryRestoreOidcUser,
} from "@/lib/oidc";
import {
  clearRuntimeFailure,
  ensureCorrelationId,
  recordRuntimeFailure,
} from "@/lib/runtime-correlation";
import {
  getRuntimeFailureMessage,
  FRONTEND_FAILURE_CODES,
  type RuntimeFailure,
} from "@/lib/runtime-failures";

export interface AuthUser {
  sub: string;
  email: string;
  realm: string;
  role: string;
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastFailure: RuntimeFailure | null;
  login: () => void;
  logout: () => void;
  recoverSession: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function extractRealm(issuer: string | undefined) {
  if (!issuer) {
    return "unknown";
  }

  const issuerSegments = issuer.split("/").filter(Boolean);
  const realmsIndex = issuerSegments.lastIndexOf("realms");

  if (realmsIndex < 0 || realmsIndex === issuerSegments.length - 1) {
    return "unknown";
  }

  return issuerSegments[realmsIndex + 1] ?? "unknown";
}

function extractRoles(profile: OidcProfile) {
  const realmRoles = toStringArray(profile.realm_access?.roles);
  const resourceRoles = Object.values(profile.resource_access ?? {}).flatMap(
    (resource) => toStringArray(resource.roles)
  );

  return Array.from(new Set([...realmRoles, ...resourceRoles]));
}

function toAuthUser(user: User) {
  const profile = user.profile as OidcProfile;
  const roles = extractRoles(profile);

  return {
    sub: profile.sub,
    email: profile.email ?? profile.preferred_username ?? profile.sub,
    realm: extractRealm(profile.iss),
    role: roles[0] ?? "authenticated",
    permissions: Array.from(new Set([...roles, ...user.scopes])),
  } satisfies AuthUser;
}

function resolveAuthErrorMessage(
  error: unknown,
  runtimeFailure: RuntimeFailure,
  fallback: string
) {
  if (runtimeFailure) {
    return getRuntimeFailureMessage(
      runtimeFailure,
      fallback
    );
  }

  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

function buildAuthRuntimeFailure(options: {
  code: string;
  message: string;
  failureCode: string;
  recoveryHint: string;
  retryable: boolean;
  runtimeBoundary?: string;
}) {
  return {
    code: options.code,
    message: options.message,
    failureCode: options.failureCode,
    correlationId: ensureCorrelationId(null),
    requestId: null,
    deploymentId: env.deploymentId,
    contractVersion: env.contractVersion,
    recoveryHint: options.recoveryHint,
    retryable: options.retryable,
    runtimeBoundary: options.runtimeBoundary ?? "frontend_auth",
    mutationId: null,
    replayGroupId: null,
    idempotentReplay: false,
    status: 0,
    capturedAt: Date.now(),
  } satisfies RuntimeFailure;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const userManagerRef = useRef<ReturnType<typeof getOidcUserManager> | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return !(
      isOidcCallbackPath(window.location.pathname) ||
      isOidcSilentCallbackPath(window.location.pathname)
    );
  });
  const [error, setError] = useState<string | null>(null);
  const [lastFailure, setLastFailure] = useState<RuntimeFailure | null>(null);

  const resetAuthErrorState = useCallback(() => {
    setError(null);
    setLastFailure(null);
    clearRuntimeFailure();
  }, []);

  const applyResolvedUser = useCallback(
    (resolvedUser: User | null) => {
      setUser(resolvedUser ? toAuthUser(resolvedUser) : null);
      resetAuthErrorState();
      setIsLoading(false);
    },
    [resetAuthErrorState]
  );

  const handleAuthFailure = useCallback(
    (
      cause: unknown,
      options: {
        code: string;
        message: string;
        failureCode: string;
        recoveryHint: string;
        retryable: boolean;
        fallback: string;
      }
    ) => {
      const runtimeFailure = buildAuthRuntimeFailure({
        code: options.code,
        message: options.message,
        failureCode: options.failureCode,
        recoveryHint: options.recoveryHint,
        retryable: options.retryable,
      });

      recordRuntimeFailure(runtimeFailure);
      setLastFailure(runtimeFailure);
      setError(resolveAuthErrorMessage(cause, runtimeFailure, options.fallback));
      setIsLoading(false);
    },
    []
  );

  const loadUser = useCallback(async () => {
    try {
      const restoredUser = await tryRestoreOidcUser();
      applyResolvedUser(restoredUser);
    } catch (cause) {
      setUser(null);
      handleAuthFailure(cause, {
        code: "oidc_session_restore_failed",
        message: "The frontend could not restore the OIDC session from browser storage.",
        failureCode: FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
        recoveryHint: "start_login",
        retryable: true,
        fallback:
          "We could not restore your sign-in session from the browser. Start the sign-in flow again.",
      });
    }
  }, [applyResolvedUser, handleAuthFailure]);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    resetAuthErrorState();

    try {
      const refreshedUser = await refreshOidcUser();
      applyResolvedUser(refreshedUser);
    } catch (cause) {
      setUser(null);
      handleAuthFailure(cause, {
        code: "oidc_session_refresh_failed",
        message: "The frontend could not refresh the OIDC session.",
        failureCode: FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
        recoveryHint: "start_login",
        retryable: true,
        fallback:
          "We could not refresh your sign-in session. Start the sign-in flow again.",
      });
    }
  }, [applyResolvedUser, handleAuthFailure, resetAuthErrorState]);

  const recoverSession = useCallback(() => {
    setIsLoading(true);
    resetAuthErrorState();

    void (async () => {
      try {
        const restoredUser = await recoverOidcSession();

        if (restoredUser) {
          applyResolvedUser(restoredUser);
        }
      } catch (cause) {
        setUser(null);
        handleAuthFailure(cause, {
          code: "oidc_session_recovery_failed",
          message: "The frontend could not recover the OIDC session.",
          failureCode: FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
          recoveryHint: "start_login",
          retryable: true,
          fallback:
            "We could not resume your sign-in session. Start the sign-in flow again.",
        });
      }
    })();
  }, [applyResolvedUser, handleAuthFailure, resetAuthErrorState]);

  const login = useCallback(() => {
    setIsLoading(true);
    resetAuthErrorState();

    void (async () => {
      try {
        await startOidcLogin();
      } catch (cause) {
        handleAuthFailure(cause, {
          code: "oidc_login_start_failed",
          message: "The frontend could not start the OIDC login redirect.",
          failureCode: FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
          recoveryHint: "retry_login",
          retryable: true,
          fallback:
            "We could not start the sign-in flow. Retry the request in this browser.",
        });
      }
    })();
  }, [handleAuthFailure, resetAuthErrorState]);

  const logout = useCallback(() => {
    setIsLoading(true);
    resetAuthErrorState();
    setUser(null);

    void (async () => {
      try {
        await logoutOidcSession();
      } catch (cause) {
        handleAuthFailure(cause, {
          code: "oidc_logout_failed",
          message: "The frontend could not complete the OIDC logout redirect.",
          failureCode: FRONTEND_FAILURE_CODES.FE_AUTH_BOOTSTRAP_FAILED,
          recoveryHint: "retry_logout",
          retryable: true,
          fallback:
            "We could not complete sign-out with the identity provider. Retry the request in this browser.",
        });
      }
    })();
  }, [handleAuthFailure, resetAuthErrorState]);

  useEffect(() => {
    const userManager = getOidcUserManager();
    userManagerRef.current = userManager;

    // Do not call startSilentRenew() here.
    // It caused signinSilent/exchangeRefreshToken loops when stale refresh tokens existed.

    const userLoadedCleanup = userManager.events.addUserLoaded((loadedUser) => {
      applyResolvedUser(loadedUser);
    });

    const userUnloadedCleanup = userManager.events.addUserUnloaded(() => {
      applyResolvedUser(null);
    });

    const userSignedOutCleanup = userManager.events.addUserSignedOut(() => {
      applyResolvedUser(null);
    });

    const accessTokenExpiredCleanup = userManager.events.addAccessTokenExpired(() => {
      void (async () => {
        await cleanupOidcBrowserState();
        applyResolvedUser(null);
      })();
    });

    const silentRenewErrorCleanup = userManager.events.addSilentRenewError(() => {
      void (async () => {
        await cleanupOidcBrowserState();
        applyResolvedUser(null);
      })();
    });

    if (
      typeof window !== "undefined" &&
      !isOidcCallbackPath(window.location.pathname) &&
      !isOidcSilentCallbackPath(window.location.pathname)
    ) {
      // Restore once after client mount.
      // If the stored browser session is stale, lib/oidc.ts cleans it and returns null.
      queueMicrotask(() => {
        void loadUser();
      });
    }

    return () => {
      userLoadedCleanup();
      userUnloadedCleanup();
      userSignedOutCleanup();
      accessTokenExpiredCleanup();
      silentRenewErrorCleanup();

      void cleanupOidcBrowserState();
      userManagerRef.current = null;
    };
  }, [applyResolvedUser, loadUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      error,
      lastFailure,
      login,
      logout,
      recoverSession,
      refreshUser,
      clearError: resetAuthErrorState,
    }),
    [
      error,
      isLoading,
      lastFailure,
      login,
      logout,
      recoverSession,
      refreshUser,
      resetAuthErrorState,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}