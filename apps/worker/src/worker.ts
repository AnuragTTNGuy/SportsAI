import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { createDb } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import { runIngestSchedulesJob } from "./jobs/ingest-schedules.js";
import { runIngestStandingsJob } from "./jobs/ingest-standings.js";
import { runComputeInsightsJob } from "./jobs/compute-insights.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const { db, close: closeDb } = createDb(databaseUrl);
const cache = createCacheClient(redisUrl);

const ingestQueue = new Queue("ingest", { connection });
const computeQueue = new Queue("compute", { connection });

async function scheduleRecurringJobs() {
  await ingestQueue.add(
    "ingest-schedules",
    { date: new Date().toISOString().slice(0, 10) },
    { repeat: { pattern: "*/15 * * * *" }, removeOnComplete: 100 },
  );

  await ingestQueue.add(
    "ingest-standings",
    {},
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: 100 },
  );

  await computeQueue.add(
    "compute-insights",
    {},
    { repeat: { pattern: "*/10 * * * *" }, removeOnComplete: 100 },
  );
}

const ingestWorker = new Worker(
  "ingest",
  async (job) => {
    if (job.name === "ingest-schedules") {
      await runIngestSchedulesJob(db, cache, job.data as { date?: string; competitionProviderId?: string });
    }

    if (job.name === "ingest-standings") {
      await runIngestStandingsJob(db, cache, job.data as { competitionProviderId?: string });
    }
  },
  { connection },
);

const computeWorker = new Worker(
  "compute",
  async (job) => {
    if (job.name === "compute-insights") {
      await runComputeInsightsJob(db, cache, job.data as { eventId?: string });
    }
  },
  { connection },
);

ingestWorker.on("failed", (job, error) => {
  console.error(`Ingest job ${job?.name} failed:`, error);
});

computeWorker.on("failed", (job, error) => {
  console.error(`Compute job ${job?.name} failed:`, error);
});

async function bootstrap() {
  await scheduleRecurringJobs();

  await ingestQueue.add("ingest-schedules", { date: new Date().toISOString().slice(0, 10) });
  await ingestQueue.add("ingest-standings", {});
  await computeQueue.add("compute-insights", {});

  console.log("Worker started. Scheduled ingest and compute jobs.");
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await ingestWorker.close();
  await computeWorker.close();
  await ingestQueue.close();
  await computeQueue.close();
  await cache.disconnect();
  await closeDb();
  await connection.quit();
  process.exit(0);
});
