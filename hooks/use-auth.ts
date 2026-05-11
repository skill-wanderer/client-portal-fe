// hooks/use-auth.ts

"use client";

import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Hook to access auth state and actions.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  return useAuthContext();
}
