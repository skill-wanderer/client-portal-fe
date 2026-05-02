import { env } from "@/lib/env";
import type { AuthConfig } from "./types";

/**
 * Auth configuration derived from environment variables.
 */
export const authConfig: AuthConfig = {
  url: env.keycloakUrl,
  realm: env.keycloakRealm,
  clientId: env.keycloakClientId,
};

export function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function getRemainingSessionMaxAge(
  refreshExpiresAt: number,
  now = Math.floor(Date.now() / 1000)
) {
  return Math.max(0, refreshExpiresAt - now);
}
