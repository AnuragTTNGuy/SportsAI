import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof createDb>["db"];

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });

  return {
    db,
    async close() {
      await client.end();
    },
  };
}

export * from "./schema/index.js";
