"use client";

import { createContext, useCallback, useMemo, useState } from "react";
import type { User } from "@/types";
import type { AuthContextValue } from "./types";

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Auth provider placeholder.
 * Replace internals with real Keycloak adapter when ready.
 * The interface contract (AuthContextValue) remains stable.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    // TODO: Replace with Keycloak redirect
    setIsLoading(true);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    // TODO: Replace with Keycloak logout
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
