import "dotenv/config";
import { createDb } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import { runIngestSchedulesJob } from "./jobs/ingest-schedules.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const dateArg = process.argv.find((arg) => arg.startsWith("--date="))?.split("=")[1];
  const competitionArg = process.argv.find((arg) => arg.startsWith("--competition="))?.split("=")[1];

  const { db, close } = createDb(databaseUrl);
  const cache = createCacheClient(redisUrl);

  try {
    await runIngestSchedulesJob(db, cache, {
      date: dateArg,
      competitionProviderId: competitionArg,
    });
  } finally {
    await cache.disconnect();
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
