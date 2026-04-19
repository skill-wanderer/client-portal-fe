import type { Session, User } from "@/types";

/**
 * Auth provider adapter interface.
 * Implementations will wrap specific providers (Keycloak, etc.)
 */
export interface AuthAdapter {
  /** Initialize the auth provider */
  init(): Promise<void>;

  /** Redirect to login */
  login(): Promise<void>;

  /** Perform logout */
  logout(): Promise<void>;

  /** Get current session or null if unauthenticated */
  getSession(): Promise<Session | null>;

  /** Refresh the access token */
  refreshToken(): Promise<string | null>;
}

/**
 * Auth context shape exposed to React components.
 */
export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Configuration for the auth provider.
 */
export interface AuthConfig {
  url: string;
  realm: string;
  clientId: string;
}
