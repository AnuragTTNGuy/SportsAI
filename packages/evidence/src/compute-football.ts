import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@sports-insights/db";
import { competitions, events, teams } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import {
  deriveBothTeamsToScoreTrend,
  deriveCorrectScore,
  deriveFormGuide,
  deriveH2H,
  deriveHalfResults,
  deriveOverUnder25,
  RECENT_FORM_MATCHES,
} from "@sports-insights/derive";
import {
  createSportsDataIoProvider,
  deriveHeadToHeadFromGames,
  type SportsDataProvider,
} from "@sports-insights/provider";
import { CACHE_TTL } from "@sports-insights/shared";
import {
  buildInsightResponse,
  createStatSnapshot,
  replaceLineups,
  upsertEvidence,
  writeAuditLog,
} from "./service.js";

function getFootballProvider() {
  const apiKey = process.env.SPORTSDATAIO_API_KEY ?? "";
  const baseUrl = process.env.SPORTSDATAIO_BASE_URL ?? "https://api.sportsdata.io/v4/soccer";
  return createSportsDataIoProvider({ apiKey, baseUrl });
}

export async function computeFootballInsightsForEvent(
  db: Database,
  cache: CacheClient,
  eventId: string,
  provider: ReturnType<typeof createSportsDataIoProvider> = getFootballProvider(),
): Promise<boolean> {
  const homeTeamAlias = alias(teams, "home_team");
  const awayTeamAlias = alias(teams, "away_team");

  const [eventRow] = await db
    .select({
      id: events.id,
      providerId: events.providerId,
      competitionId: events.competitionId,
      competitionProviderId: competitions.providerId,
      homeTeamProviderId: homeTeamAlias.providerId,
      awayTeamProviderId: awayTeamAlias.providerId,
      homeTeamName: homeTeamAlias.name,
      awayTeamName: awayTeamAlias.name,
      scheduledAt: events.scheduledAt,
    })
    .from(events)
    .innerJoin(competitions, eq(events.competitionId, competitions.id))
    .innerJoin(homeTeamAlias, eq(events.homeTeamId, homeTeamAlias.id))
    .innerJoin(awayTeamAlias, eq(events.awayTeamId, awayTeamAlias.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!eventRow) return false;

  let homeStats;
  let awayStats;
  try {
    homeStats = await provider.getTeamStats(eventRow.homeTeamProviderId, RECENT_FORM_MATCHES);
    homeStats.team.name = eventRow.homeTeamName;
    awayStats = await provider.getTeamStats(eventRow.awayTeamProviderId, RECENT_FORM_MATCHES);
    awayStats.team.name = eventRow.awayTeamName;
  } catch (error) {
    console.warn(
      `SportsDataIO team stats unavailable for event ${eventId}:`,
      (error as Error).message,
    );
    return false;
  }

  const homeSnapshot = await createStatSnapshot(db, {
    eventId,
    snapshotType: "team_recent_form",
    payload: homeStats as unknown as Record<string, unknown>,
  });

  const awaySnapshot = await createStatSnapshot(db, {
    eventId,
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

  const competitionProviderId =
    eventRow.competitionProviderId
    || process.env.DEFAULT_COMPETITION_ID
    || "1";

  let competitionEvents: Awaited<ReturnType<SportsDataProvider["getSchedules"]>> = [];
  try {
    competitionEvents = await provider.getSchedules(competitionProviderId, eventRow.scheduledAt);
  } catch {
    try {
      competitionEvents = await provider.getSchedulesByDate(eventRow.scheduledAt);
    } catch {
      competitionEvents = [];
    }
  }

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

  await upsertEvidence(db, {
    eventId,
    type: "trend",
    payload: deriveBothTeamsToScoreTrend(homeStats, awayStats) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "over_under",
    payload: deriveOverUnder25(homeStats, awayStats) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "correct_score",
    payload: deriveCorrectScore(homeStats, awayStats, h2hStats) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "half_results",
    payload: deriveHalfResults(
      homeStats,
      awayStats,
      h2hStats,
      eventRow.homeTeamName,
    ) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "stats",
    payload: {
      homeTeam: homeStats,
      awayTeam: awayStats,
      sport: "football",
      source: "sportsdataio",
    },
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  try {
    const lineups = await provider.getLineups(eventRow.providerId);
    const homeTeamRow = await db.query.teams.findFirst({
      where: eq(teams.providerId, eventRow.homeTeamProviderId),
    });
    const awayTeamRow = await db.query.teams.findFirst({
      where: eq(teams.providerId, eventRow.awayTeamProviderId),
    });

    if (homeTeamRow && awayTeamRow) {
      const teamIdMap = new Map<string, string>([
        [eventRow.homeTeamProviderId, homeTeamRow.id],
        [eventRow.awayTeamProviderId, awayTeamRow.id],
      ]);
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
  } catch {
    // Lineups are often unavailable for upcoming fixtures
  }

  const response = await buildInsightResponse(db, eventId);
  if (response && response.cards.length > 0) {
    await cache.setInsightPayload(eventId, response, CACHE_TTL.insights);
  }

  await writeAuditLog(db, "compute_football_insights", "events", eventId, { source: "sportsdataio" });
  console.log(`Computed football insights for event ${eventId} (sportsdataio)`);
  return Boolean(response && response.cards.length > 0);
}

export async function ensureFootballInsights(
  db: Database,
  cache: CacheClient,
  eventId: string,
): Promise<void> {
  await computeFootballInsightsForEvent(db, cache, eventId);
}
