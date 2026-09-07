import type { Database } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import { createSportsDataIoProvider } from "@sports-insights/provider";
import {
  replaceStandings,
  upsertCompetition,
  upsertTeam,
  writeAuditLog,
} from "@sports-insights/evidence";

function getProvider() {
  const apiKey = process.env.SPORTSDATAIO_API_KEY ?? "";
  const baseUrl = process.env.SPORTSDATAIO_BASE_URL ?? "https://api.sportsdata.io/v4/soccer";

  return createSportsDataIoProvider({ apiKey, baseUrl });
}

export async function runIngestStandingsJob(
  db: Database,
  cache: CacheClient,
  data: { competitionProviderId?: string },
) {
  const provider = getProvider();
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
  const standings = await provider.getStandings(competition.providerId);
  const teamIdMap = new Map<string, string>();

  for (const row of standings) {
    const team = await upsertTeam(db, row.team);
    teamIdMap.set(row.team.providerId, team.id);
  }

  await replaceStandings(db, competitionRow.id, standings, teamIdMap);

  const ladderPayload = {
    competitionId: competitionRow.id,
    capturedAt: new Date().toISOString(),
    standings: standings.map((row) => ({
      teamName: row.team.name,
      position: row.position,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
    })),
  };

  await cache.setLadder(competitionRow.id, ladderPayload, 3600);

  await writeAuditLog(db, "ingest_standings", "competitions", competitionRow.id, {
    count: standings.length,
  });

  console.log(`Ingested ${standings.length} standings rows`);
}
