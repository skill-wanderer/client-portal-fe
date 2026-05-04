import { FileSessionStore } from "@/lib/auth/session-file-store";
import type { SessionStore } from "@/lib/auth/session-store";

const fileSessionStore = new FileSessionStore();

export function createSessionStore(): SessionStore {
  return fileSessionStore;
}