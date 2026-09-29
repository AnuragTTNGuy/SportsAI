import "dotenv/config";
import { createDb } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import { runIngestNbaSchedulesJob } from "./jobs/ingest-nba-schedules.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const upcomingArg = process.argv.find((arg) => arg.startsWith("--upcoming="))?.split("=")[1];
  const noFallback = process.argv.includes("--no-fallback");
  const keepCompleted = process.argv.includes("--keep-completed");
  const fallbackOnly = process.argv.includes("--fallback-only");

  const { db, close } = createDb(databaseUrl);
  const cache = createCacheClient(redisUrl);

  try {
    await runIngestNbaSchedulesJob(db, cache, {
      includeUpcomingDays: upcomingArg != null ? Number(upcomingArg) : 14,
      allowFallbackSlate: !noFallback,
      pruneCompleted: !keepCompleted,
      fallbackOnly,
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
