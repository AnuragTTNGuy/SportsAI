import fp from "fastify-plugin";
import { createDb, type Database } from "@sports-insights/db";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export const dbPlugin = fp(async (fastify) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const { db, close } = createDb(connectionString);
  fastify.decorate("db", db);

  fastify.addHook("onClose", async () => {
    await close();
  });
});
