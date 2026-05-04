import type { Session } from "@/types";
import type { SessionStore } from "@/lib/auth/session-store";

export class RedisSessionStore implements SessionStore {
  async get(_sessionId: string): Promise<Session | null> {
    throw new Error("redis_session_store_not_implemented");
  }

  async set(_sessionId: string, _session: Session): Promise<void> {
    throw new Error("redis_session_store_not_implemented");
  }

  async delete(_sessionId: string): Promise<void> {
    throw new Error("redis_session_store_not_implemented");
  }
}