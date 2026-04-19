// lib/env.ts

/**
 * Centralized environment configuration.
 * All env access goes through here — single source of truth.
 */

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  /** Application base URL */
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  /** Keycloak server URL (server-side only) */
  keycloakUrl: optional("KEYCLOAK_URL", "http://localhost:8080"),

  /** Keycloak realm */
  keycloakRealm: optional("KEYCLOAK_REALM", "client-portal"),

  /** Keycloak client ID */
  keycloakClientId: optional("KEYCLOAK_CLIENT_ID", "client-portal-fe"),

  /** Keycloak client secret (server-side only, required in production) */
  get keycloakClientSecret(): string {
    if (process.env.NODE_ENV === "production") {
      return required("KEYCLOAK_CLIENT_SECRET");
    }
    return optional("KEYCLOAK_CLIENT_SECRET", "");
  },

  /** Node environment */
  nodeEnv: optional("NODE_ENV", "development"),

  /** Whether we're in production */
  isProduction: process.env.NODE_ENV === "production",
} as const;
