import type { Session } from "@/types";

/**
 * Session store interface contract.
 * No TTL logic inside the store — TTL is enforced by middleware.
 */
export interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  set(sessionId: string, session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

/**
 * In-memory session store implementation.
 * Suitable for development and single-process deployments.
 * Replace with Redis adapter for production horizontal scaling.
 */
const store = new Map<string, Session>();

export const sessionStore: SessionStore = {
  async get(sessionId: string): Promise<Session | null> {
    return store.get(sessionId) ?? null;
  },

  async set(sessionId: string, session: Session): Promise<void> {
    store.set(sessionId, session);
  },

  async delete(sessionId: string): Promise<void> {
    store.delete(sessionId);
  },
};
