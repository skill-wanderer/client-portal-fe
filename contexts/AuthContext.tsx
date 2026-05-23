"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  apiFetch,
  getApiClientRuntimeFailure,
  getApiClientErrorMessage,
  isApiClientError,
  isUnauthenticatedApiError,
} from "@/lib/api-client";
import { login as startLogin, recoverAuthSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { getCanonicalLoopbackUrl } from "@/lib/local-origin";
import {
  clearPendingAuthRedirectFlow,
  clearRuntimeFailure,
  getLastRuntimeFailure,
  prepareAuthBootstrapContext,
  recordRuntimeFailure,
} from "@/lib/runtime-correlation";
import {
  getRuntimeFailureMessage,
  isRecoverableAuthFailure,
  type RuntimeFailure,
} from "@/lib/runtime-failures";

interface AuthMeResponse {
  authenticated: boolean;
  user: {
    sub: string;
    email: string;
    realm: string;
  };
  role: string;
  permissions: string[];
}

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
  recoverSession: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(payload: AuthMeResponse) {
  return {
    sub: payload.user.sub,
    email: payload.user.email,
    realm: payload.user.realm,
    role: payload.role,
    permissions: payload.permissions,
  } satisfies AuthUser;
}

function getAuthErrorMessage(error: unknown, runtimeFailure: RuntimeFailure | null) {
  if (isApiClientError(error)) {
    if (error.code === "no_mapping") {
      return "Your sign-in succeeded, but this email is not provisioned for the client portal.";
    }

    if (error.code === "invalid_role") {
      return "Your account is signed in, but it is not authorized for this client portal.";
    }
  }

  if (runtimeFailure) {
    return getRuntimeFailureMessage(
      runtimeFailure,
      "We could not verify your session. Check the backend connection and try again."
    );
  }

  return getApiClientErrorMessage(
    error,
    "We could not verify your session. Check the backend connection and try again."
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFailure, setLastFailure] = useState<RuntimeFailure | null>(() =>
    getLastRuntimeFailure()
  );

  const loadUser = useCallback(async () => {
    if (typeof window !== "undefined") {
      const normalizedUrl = getCanonicalLoopbackUrl(
        window.location.href,
        env.apiBaseUrl
      );

      if (normalizedUrl) {
        window.location.replace(normalizedUrl);
        return;
      }
    }

    let shouldClearPendingAuthFlow = false;

    try {
      const authBootstrapContext = prepareAuthBootstrapContext();
      const response = await apiFetch<AuthMeResponse>("/v1/auth/me", {
        cache: "no-store",
        correlationId: authBootstrapContext.correlationId,
      });

      if (!response.authenticated) {
        setUser(null);
        setError(null);
        setLastFailure(null);
        clearRuntimeFailure();
        return;
      }

      setUser(toAuthUser(response));
      setError(null);
      setLastFailure(null);
      clearRuntimeFailure();
      shouldClearPendingAuthFlow = true;
    } catch (error) {
      const runtimeFailure = getApiClientRuntimeFailure(error);

      setUser(null);

      if (runtimeFailure) {
        recordRuntimeFailure(runtimeFailure);
        setLastFailure(runtimeFailure);
      } else {
        setLastFailure(null);
      }

      if (isUnauthenticatedApiError(error)) {
        setError(null);
      } else {
        setError(getAuthErrorMessage(error, runtimeFailure));
      }

      if (!runtimeFailure || !isRecoverableAuthFailure(runtimeFailure)) {
        shouldClearPendingAuthFlow = true;
      }
    } finally {
      if (shouldClearPendingAuthFlow) {
        clearPendingAuthRedirectFlow();
      }

      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await loadUser();
  }, [loadUser]);

  const recoverSession = useCallback(() => {
    setError(null);
    recoverAuthSession();
  }, []);

  useEffect(() => {
    // The backend session cookie is scoped to the API host, so auth state must be loaded from the browser after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUser();
  }, [loadUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      error,
      lastFailure,
      login: startLogin,
      recoverSession,
      refreshUser,
      clearError: () => setError(null),
    }),
    [error, isLoading, lastFailure, recoverSession, refreshUser, user]
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