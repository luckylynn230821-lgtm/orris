import { dbSource, getPglite } from "@/lib/db";

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

type Pool = import("pg").Pool;

const globalPool = globalThis as typeof globalThis & { __orrisPool?: Pool };

export async function withTx<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  if (dbSource === "pglite") {
    const pg = await getPglite();
    return pg.transaction(async (tx) => {
      const query = (async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
        const result = await tx.query(text, params);
        return result.rows as T[];
      }) as Query;
      return fn(query);
    });
  }

  const { Pool } = await import("pg");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  globalPool.__orrisPool ??= new Pool({ connectionString });
  const client = await globalPool.__orrisPool.connect();
  try {
    await client.query("begin");
    const query = (async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => {
      const result = await client.query(text, params);
      return result.rows as T[];
    }) as Query;
    const value = await fn(query);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
