import { and, eq } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { competitions } from "@sports-insights/db";
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

export async function runIngestSchedulesJob(
  db: Database,
  _cache: CacheClient,
  data: { date?: string; competitionProviderId?: string },
) {
  const provider = getProvider();
  const date = data.date ? new Date(data.date) : new Date();
  const dateLabel = date.toISOString().slice(0, 10);

  const schedules = data.competitionProviderId
    ? await provider.getSchedules(data.competitionProviderId, date)
    : await provider.getSchedulesByDate(date);

  let ingested = 0;
  let skipped = 0;
  const competitionsIngested = new Set<string>();

  for (const schedule of schedules) {
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

  await writeAuditLog(db, "ingest_schedules", "events", undefined, {
    date: dateLabel,
    ingested,
    skipped,
    competitions: [...competitionsIngested],
  });

  console.log(
    `Ingested ${ingested} schedules for ${dateLabel}`
    + (skipped ? ` (${skipped} skipped — competition not in catalog)` : "")
    + (competitionsIngested.size ? ` across ${competitionsIngested.size} competitions` : ""),
  );
}
