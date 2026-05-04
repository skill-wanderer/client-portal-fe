import { createSessionStore } from "@/lib/auth/session-factory";

export type { SessionStore } from "@/lib/auth/session-store";

export const sessionStore = createSessionStore();
