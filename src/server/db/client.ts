import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __talsSql?: postgres.Sql; __talsDb?: Db };

export function sqlClient(): postgres.Sql {
  if (!globalForDb.__talsSql) {
    globalForDb.__talsSql = postgres(env().DATABASE_URL, {
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      onnotice: () => {},
    });
  }
  return globalForDb.__talsSql;
}

export function db(): Db {
  if (!globalForDb.__talsDb) {
    globalForDb.__talsDb = drizzle(sqlClient(), { schema });
  }
  return globalForDb.__talsDb;
}

export async function closeDb(): Promise<void> {
  if (globalForDb.__talsSql) {
    await globalForDb.__talsSql.end({ timeout: 5 });
    globalForDb.__talsSql = undefined;
    globalForDb.__talsDb = undefined;
  }
}

export { schema };
