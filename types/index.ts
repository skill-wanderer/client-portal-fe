/**
 * Shared application types used across module boundaries.
 */

export type UserRole = string;

export interface User {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

/**
 * Server-side session stored in the session store.
 * Never exposed to the browser.
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  user: User;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  createdAt: number;
}
