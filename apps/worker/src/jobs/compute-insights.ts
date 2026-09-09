import { eq } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { events, teams } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import { deriveBothTeamsToScoreTrend, deriveFormGuide, deriveH2H, deriveOverUnder25, deriveCorrectScore, deriveHalfResults } from "@sports-insights/derive";
import {
  buildInsightResponse,
  createStatSnapshot,
  replaceLineups,
  upsertEvidence,
  writeAuditLog,
} from "@sports-insights/evidence";
import { createSportsDataIoProvider, deriveHeadToHeadFromGames } from "@sports-insights/provider";
import { CACHE_TTL } from "@sports-insights/shared";
import { alias } from "drizzle-orm/pg-core";

function getProvider() {
  const apiKey = process.env.SPORTSDATAIO_API_KEY ?? "";
  const baseUrl = process.env.SPORTSDATAIO_BASE_URL ?? "https://api.sportsdata.io/v4/soccer";

  return createSportsDataIoProvider({ apiKey, baseUrl });
}

export async function runComputeInsightsJob(
  db: Database,
  cache: CacheClient,
  data: { eventId?: string },
) {
  const provider = getProvider();
  const targetEvents = data.eventId
    ? await db.query.events.findMany({ where: eq(events.id, data.eventId) })
    : await db.query.events.findMany({ limit: 50 });

  for (const event of targetEvents) {
    await computeInsightsForEvent(db, cache, provider, event.id);
  }
}

async function computeInsightsForEvent(
  db: Database,
  cache: CacheClient,
  provider: ReturnType<typeof createSportsDataIoProvider>,
  eventId: string,
) {
  const homeTeamAlias = alias(teams, "home_team");
  const awayTeamAlias = alias(teams, "away_team");

  const [eventRow] = await db
    .select({
      id: events.id,
      providerId: events.providerId,
      competitionId: events.competitionId,
      homeTeamProviderId: homeTeamAlias.providerId,
      awayTeamProviderId: awayTeamAlias.providerId,
      homeTeamName: homeTeamAlias.name,
      awayTeamName: awayTeamAlias.name,
    })
    .from(events)
    .innerJoin(homeTeamAlias, eq(events.homeTeamId, homeTeamAlias.id))
    .innerJoin(awayTeamAlias, eq(events.awayTeamId, awayTeamAlias.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!eventRow) return;

  const homeStats = await provider.getTeamStats(eventRow.homeTeamProviderId, 5);
  const awayStats = await provider.getTeamStats(eventRow.awayTeamProviderId, 5);

  const homeSnapshot = await createStatSnapshot(db, {
    eventId,
    teamId: undefined,
    snapshotType: "team_recent_form",
    payload: homeStats as unknown as Record<string, unknown>,
  });

  const awaySnapshot = await createStatSnapshot(db, {
    eventId,
    teamId: undefined,
    snapshotType: "team_recent_form",
    payload: awayStats as unknown as Record<string, unknown>,
  });

  const formPayload = deriveFormGuide(homeStats, awayStats);
  await upsertEvidence(db, {
    eventId,
    type: "form_guide",
    payload: formPayload as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  const competitionEvents = await provider.getSchedules(
    process.env.DEFAULT_COMPETITION_ID ?? "1",
    new Date(),
  );
  const h2hStats = deriveHeadToHeadFromGames(
    eventRow.homeTeamName,
    eventRow.awayTeamName,
    competitionEvents,
  );
  const h2hPayload = deriveH2H(eventRow.homeTeamName, eventRow.awayTeamName, h2hStats);
  await upsertEvidence(db, {
    eventId,
    type: "h2h",
    payload: h2hPayload as unknown as Record<string, unknown>,
  });

  const trendPayload = deriveBothTeamsToScoreTrend(homeStats, awayStats);
  await upsertEvidence(db, {
    eventId,
    type: "trend",
    payload: trendPayload as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  const overUnderPayload = deriveOverUnder25(homeStats, awayStats);
  await upsertEvidence(db, {
    eventId,
    type: "over_under",
    payload: overUnderPayload as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  const correctScorePayload = deriveCorrectScore(homeStats, awayStats, h2hStats);
  await upsertEvidence(db, {
    eventId,
    type: "correct_score",
    payload: correctScorePayload as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  const halfResultsPayload = deriveHalfResults(
    homeStats,
    awayStats,
    h2hStats,
    eventRow.homeTeamName,
  );
  await upsertEvidence(db, {
    eventId,
    type: "half_results",
    payload: halfResultsPayload as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "stats",
    payload: {
      homeTeam: homeStats,
      awayTeam: awayStats,
    },
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  const lineups = await provider.getLineups(eventRow.providerId);
  const teamIdMap = new Map<string, string>([
    [eventRow.homeTeamProviderId, eventRow.homeTeamProviderId],
    [eventRow.awayTeamProviderId, eventRow.awayTeamProviderId],
  ]);

  const homeTeamRow = await db.query.teams.findFirst({
    where: eq(teams.providerId, eventRow.homeTeamProviderId),
  });
  const awayTeamRow = await db.query.teams.findFirst({
    where: eq(teams.providerId, eventRow.awayTeamProviderId),
  });

  if (homeTeamRow && awayTeamRow) {
    teamIdMap.set(eventRow.homeTeamProviderId, homeTeamRow.id);
    teamIdMap.set(eventRow.awayTeamProviderId, awayTeamRow.id);
    await replaceLineups(db, eventId, lineups, teamIdMap);
  }

  await upsertEvidence(db, {
    eventId,
    type: "lineup",
    payload: {
      lineups,
      confirmed: lineups.some((l) => l.confirmed),
    },
  });

  const response = await buildInsightResponse(db, eventId);
  if (response) {
    await cache.setInsightPayload(eventId, response, CACHE_TTL.insights);
  }

  await writeAuditLog(db, "compute_insights", "events", eventId);
  console.log(`Computed insights for event ${eventId}`);
}
