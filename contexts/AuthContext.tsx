"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { login as startLogin } from "@/lib/auth";

interface AuthMeResponse {
  user: {
    id: string;
    email: string;
  };
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
  login: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(payload: AuthMeResponse) {
  return {
    sub: payload.user.id,
    email: payload.user.email,
    realm: "",
    role: "client",
    permissions: [],
  } satisfies AuthUser;
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) {
    return null;
  }

  return "We could not verify your session. Check the backend connection and try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const response = await apiFetch<AuthMeResponse>("/v1/auth/me", {
        cache: "no-store",
      });

      setUser(toAuthUser(response));
      setError(null);
    } catch (error) {
      setUser(null);
      setError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await loadUser();
  }, [loadUser]);

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
      login: startLogin,
      refreshUser,
      clearError: () => setError(null),
    }),
    [error, isLoading, refreshUser, user]
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