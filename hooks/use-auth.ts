// hooks/use-auth.ts

"use client";

import { useContext } from "react";
import { AuthContext } from "@/lib/auth/provider";
import type { AuthContextValue } from "@/lib/auth/types";

/**
 * Hook to access auth state and actions.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
