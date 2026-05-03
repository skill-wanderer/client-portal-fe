import { Pool, type QueryResult, type QueryResultRow } from "pg";

type GlobalWithDb = typeof globalThis & {
  __clientPortalDbPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDb = globalThis as GlobalWithDb;

const pool =
  globalForDb.__clientPortalDbPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__clientPortalDbPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export { pool };