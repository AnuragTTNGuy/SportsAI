import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { competitions, events, evidenceRecords, statSnapshots } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import { createSportsDataIoProvider } from "@sports-insights/provider";
import {
  upsertEvent,
  upsertTeam,
  writeAuditLog,
} from "@sports-insights/evidence";

function getProvider() {
  const apiKey = process.env.SPORTSDATAIO_API_KEY ?? "";
  const baseUrl = process.env.SPORTSDATAIO_BASE_URL ?? "https://api.sportsdata.io/v4/soccer";

  return createSportsDataIoProvider({ apiKey, baseUrl });
}

function isCompletedStatus(status: string) {
  const normalized = status.toLowerCase();
  return ["final", "f/ot", "completed", "closed", "suspended", "cancelled", "canceled", "postponed"].includes(normalized);
}

async function deleteEventsByIds(db: Database, ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(evidenceRecords).where(inArray(evidenceRecords.eventId, ids));
  await db.delete(statSnapshots).where(inArray(statSnapshots.eventId, ids));
  await db.delete(events).where(inArray(events.id, ids));
}

async function pruneCompletedFootballEvents(db: Database) {
  const completed = await db
    .select({ id: events.id })
    .from(events)
    .where(and(
      eq(events.sport, "football"),
      sql`lower(${events.status}) in ('final', 'f/ot', 'completed', 'closed', 'cancelled', 'canceled')`,
    ));
  const ids = completed.map((row) => row.id);
  await deleteEventsByIds(db, ids);
  return ids.length;
}

export async function runIngestSchedulesJob(
  db: Database,
  _cache: CacheClient,
  data: {
    date?: string;
    competitionProviderId?: string;
    /** How many days ahead to ingest (inclusive of start date). Default 14. */
    days?: number;
    pruneCompleted?: boolean;
  },
) {
  const provider = getProvider();
  const start = data.date ? new Date(data.date) : new Date();
  start.setHours(0, 0, 0, 0);
  const days = data.days ?? 14;
  const pruneCompleted = data.pruneCompleted ?? true;

  if (pruneCompleted) {
    const removed = await pruneCompletedFootballEvents(db);
    if (removed > 0) {
      console.log(`Pruned ${removed} completed football events`);
    }
  }

  const past = await db
    .select({ id: events.id })
    .from(events)
    .where(and(
      eq(events.sport, "football"),
      lt(events.scheduledAt, start),
    ));
  await deleteEventsByIds(db, past.map((row) => row.id));

  let ingested = 0;
  let skipped = 0;
  const competitionsIngested = new Set<string>();

  for (let offset = 0; offset < days; offset++) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const dateLabel = date.toISOString().slice(0, 10);

    let schedules;
    try {
      schedules = data.competitionProviderId
        ? await provider.getSchedules(data.competitionProviderId, date)
        : await provider.getSchedulesByDate(date);
    } catch (error) {
      console.warn(`Football schedule fetch failed for ${dateLabel}:`, (error as Error).message);
      continue;
    }

    const upcoming = schedules.filter((game) => !isCompletedStatus(game.status));
    console.log(`${dateLabel}: ${upcoming.length} upcoming / ${schedules.length} total`);

    for (const schedule of upcoming) {
      const competitionRow = await db.query.competitions.findFirst({
        where: and(
          eq(competitions.provider, schedule.provider),
          eq(competitions.providerId, schedule.competitionProviderId),
        ),
      });

      if (!competitionRow) {
        skipped++;
        continue;
      }

      const homeTeam = await upsertTeam(db, schedule.homeTeam);
      const awayTeam = await upsertTeam(db, schedule.awayTeam);
      await upsertEvent(db, schedule, competitionRow.id, homeTeam.id, awayTeam.id);
      competitionsIngested.add(competitionRow.name);
      ingested++;
    }
  }

  await writeAuditLog(db, "ingest_schedules", "events", undefined, {
    startDate: start.toISOString().slice(0, 10),
    days,
    ingested,
    skipped,
    competitions: [...competitionsIngested],
  });

  console.log(
    `Ingested ${ingested} upcoming football schedules over ${days} day(s)`
    + (skipped ? ` (${skipped} skipped — competition not in catalog)` : "")
    + (competitionsIngested.size ? ` across ${competitionsIngested.size} competitions` : ""),
  );
}
