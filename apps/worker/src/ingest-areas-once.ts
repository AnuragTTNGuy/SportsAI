import "dotenv/config";
import { createDb } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import { runIngestAreasJob } from "./jobs/ingest-areas.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const { db, close } = createDb(databaseUrl);
  const cache = createCacheClient(redisUrl);

  try {
    const counts = await runIngestAreasJob(db, cache);
    console.log("Areas ingest complete:", counts);
  } finally {
    await cache.disconnect();
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
