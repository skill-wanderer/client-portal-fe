// lib/env.ts

/**
 * Centralized environment configuration.
 * All env access goes through here — single source of truth.
 */

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  /** Application base URL */
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000"),

  /** Backend API base URL */
  apiBaseUrl: optional("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:8003"),

  /** Node environment */
  nodeEnv: optional("NODE_ENV", "development"),

  /** Whether we're in production */
  isProduction: process.env.NODE_ENV === "production",
} as const;
