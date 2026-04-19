import { env } from "@/lib/env";

/**
 * Keycloak URL builders and token exchange logic.
 * Server-side only — never imported in client components.
 */

const REALM_PATH = `/realms/${env.keycloakRealm}/protocol/openid-connect`;

/** Keycloak authorization endpoint URL */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.keycloakClientId,
    redirect_uri: `${env.appUrl}/api/auth/callback`,
    response_type: "code",
    scope: "openid",
    state,
  });

  return `${env.keycloakUrl}${REALM_PATH}/auth?${params.toString()}`;
}

/** Keycloak logout endpoint URL */
export function getLogoutUrl(idToken: string): string {
  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: `${env.appUrl}/login`,
  });

  return `${env.keycloakUrl}${REALM_PATH}/logout?${params.toString()}`;
}

/** Token response from Keycloak */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  refresh_expires_in: number;
}

/** Exchange authorization code for tokens */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${env.appUrl}/api/auth/callback`,
    client_id: env.keycloakClientId,
    client_secret: env.keycloakClientSecret,
  });

  const response = await fetch(`${env.keycloakUrl}${REALM_PATH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/** Refresh access token using refresh token */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.keycloakClientId,
    client_secret: env.keycloakClientSecret,
  });

  const response = await fetch(`${env.keycloakUrl}${REALM_PATH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/** Decoded id_token payload (relevant fields only) */
interface IdTokenPayload {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

/**
 * Decode id_token server-side (base64url decode, no signature verification
 * needed since token was received directly from Keycloak over TLS).
 */
export function decodeIdToken(idToken: string): IdTokenPayload {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid id_token format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload) as IdTokenPayload;
}

/** Extract User from id_token payload */
export function extractUser(payload: IdTokenPayload) {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name || payload.preferred_username || "Unknown",
    roles: payload.realm_access?.roles || [],
  };
}
