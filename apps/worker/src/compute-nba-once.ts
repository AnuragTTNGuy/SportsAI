import "dotenv/config";
import { createDb } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import { runComputeBasketballInsightsJob } from "./jobs/compute-basketball-insights.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const eventId = process.argv.find((arg) => arg.startsWith("--event="))?.split("=")[1];
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1];

  const { db, close } = createDb(databaseUrl);
  const cache = createCacheClient(redisUrl);

  try {
    await runComputeBasketballInsightsJob(db, cache, {
      eventId,
      limit: limitArg != null ? Number(limitArg) : 25,
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
