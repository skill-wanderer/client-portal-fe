import type { Session } from "@/types";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SessionStore } from "@/lib/auth/session-store";

type SessionRecord = Record<string, Session>;

const SESSION_STORE_FILE = join(
  tmpdir(),
  "client-portal-fe",
  "sessions.json"
);

async function readStore(): Promise<SessionRecord> {
  try {
    const raw = await readFile(SESSION_STORE_FILE, "utf8");
    return JSON.parse(raw) as SessionRecord;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    throw error;
  }
}

async function writeStore(store: SessionRecord): Promise<void> {
  await mkdir(dirname(SESSION_STORE_FILE), { recursive: true });

  const temporaryFile = `${SESSION_STORE_FILE}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(temporaryFile, JSON.stringify(store), "utf8");
  await rename(temporaryFile, SESSION_STORE_FILE);
}

export class FileSessionStore implements SessionStore {
  async get(sessionId: string): Promise<Session | null> {
    const store = await readStore();
    return store[sessionId] ?? null;
  }

  async set(sessionId: string, session: Session): Promise<void> {
    const store = await readStore();
    store[sessionId] = session;
    await writeStore(store);
  }

  async delete(sessionId: string): Promise<void> {
    const store = await readStore();
    delete store[sessionId];
    await writeStore(store);
  }
}