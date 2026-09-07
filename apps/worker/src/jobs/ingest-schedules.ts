import type { Database } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import { createSportsDataIoProvider } from "@sports-insights/provider";
import {
  upsertCompetition,
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
  const competitionProviderId = data.competitionProviderId
    ?? process.env.DEFAULT_COMPETITION_ID
    ?? "1";

  const competitions = await provider.getCompetitions();
  const competition = competitions.find((c) => c.providerId === competitionProviderId)
    ?? competitions[0];

  if (!competition) {
    console.warn("No competitions available from provider");
    return;
  }

  const competitionRow = await upsertCompetition(db, competition);
  const schedules = await provider.getSchedules(competition.providerId, date);

  for (const schedule of schedules) {
    const homeTeam = await upsertTeam(db, schedule.homeTeam);
    const awayTeam = await upsertTeam(db, schedule.awayTeam);
    await upsertEvent(db, schedule, competitionRow.id, homeTeam.id, awayTeam.id);
  }

  await writeAuditLog(db, "ingest_schedules", "events", competitionRow.id, {
    date: date.toISOString().slice(0, 10),
    count: schedules.length,
  });

  console.log(`Ingested ${schedules.length} schedules for ${date.toISOString().slice(0, 10)}`);
}
