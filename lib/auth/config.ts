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
