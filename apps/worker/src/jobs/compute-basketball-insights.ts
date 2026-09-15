import { eq } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { events, teams } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import {
  deriveBasketballFormGuide,
  deriveBasketballH2H,
  deriveGamePreview,
  derivePlayerSpotlight,
  derivePointsOverUnder,
  RECENT_BASKETBALL_FORM_MATCHES,
} from "@sports-insights/derive";
import {
  buildInsightResponse,
  createStatSnapshot,
  upsertEvidence,
  writeAuditLog,
} from "@sports-insights/evidence";
import type { BasketballPlayerSpotlight } from "@sports-insights/normalise";
import { createNbaProvider, deriveBasketballHeadToHeadFromGames } from "@sports-insights/provider";
import { CACHE_TTL } from "@sports-insights/shared";
import { alias } from "drizzle-orm/pg-core";

function getNbaProvider() {
  const apiKey = process.env.SPORTSDATAIO_API_KEY ?? "";
  const baseUrl = process.env.SPORTSDATAIO_NBA_BASE_URL ?? "https://api.sportsdata.io/v3/nba/scores/json";
  return createNbaProvider({ apiKey, baseUrl });
}

function buildPlayerSpotlight(
  playerStats: Array<{
    PlayerID: number;
    Name: string;
    Position?: string;
    Day: string;
    OpponentID: number;
    Points?: number;
    Rebounds?: number;
    Assists?: number;
    Minutes?: number;
  }>,
  teamName: string,
): BasketballPlayerSpotlight | undefined {
  if (playerStats.length === 0) return undefined;

  const byPlayer = new Map<number, typeof playerStats>();
  for (const row of playerStats) {
    const list = byPlayer.get(row.PlayerID) ?? [];
    list.push(row);
    byPlayer.set(row.PlayerID, list);
  }

  let best: BasketballPlayerSpotlight | undefined;

  for (const [playerId, rows] of byPlayer) {
    const sorted = [...rows].sort((a, b) => new Date(b.Day).getTime() - new Date(a.Day).getTime()).slice(0, 5);
    const avgPoints = sorted.reduce((sum, r) => sum + (r.Points ?? 0), 0) / (sorted.length || 1);
    const avgRebounds = sorted.reduce((sum, r) => sum + (r.Rebounds ?? 0), 0) / (sorted.length || 1);
    const avgAssists = sorted.reduce((sum, r) => sum + (r.Assists ?? 0), 0) / (sorted.length || 1);

    const candidate: BasketballPlayerSpotlight = {
      playerId,
      fullName: sorted[0]?.Name ?? "Unknown",
      position: sorted[0]?.Position,
      teamName,
      lastGames: sorted.map((game) => ({
        playerId,
        fullName: game.Name,
        position: game.Position,
        gameDate: game.Day,
        opponent: String(game.OpponentID),
        points: game.Points ?? 0,
        rebounds: game.Rebounds ?? 0,
        assists: game.Assists ?? 0,
        minutes: game.Minutes,
      })),
      avgPoints: Math.round(avgPoints * 10) / 10,
      avgRebounds: Math.round(avgRebounds * 10) / 10,
      avgAssists: Math.round(avgAssists * 10) / 10,
    };

    if (!best || candidate.avgPoints > best.avgPoints) {
      best = candidate;
    }
  }

  return best;
}

export async function runComputeBasketballInsightsJob(
  db: Database,
  cache: CacheClient,
  data: { eventId?: string },
) {
  const provider = getNbaProvider();
  const targetEvents = data.eventId
    ? await db.query.events.findMany({ where: eq(events.id, data.eventId) })
    : await db.query.events.findMany({ limit: 50 });

  for (const event of targetEvents.filter((row) => row.sport === "basketball")) {
    await computeBasketballInsightsForEvent(db, cache, provider, event.id);
  }
}

async function computeBasketballInsightsForEvent(
  db: Database,
  cache: CacheClient,
  provider: ReturnType<typeof createNbaProvider>,
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

  const homeStats = await provider.getTeamGameStats(
    eventRow.homeTeamProviderId,
    RECENT_BASKETBALL_FORM_MATCHES,
  );
  homeStats.team.name = eventRow.homeTeamName;

  const awayStats = await provider.getTeamGameStats(
    eventRow.awayTeamProviderId,
    RECENT_BASKETBALL_FORM_MATCHES,
  );
  awayStats.team.name = eventRow.awayTeamName;

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

  const competitionEvents = await provider.getSchedules("nba", new Date());
  const h2hStats = deriveBasketballHeadToHeadFromGames(
    eventRow.homeTeamName,
    competitionEvents.filter(
      (game) =>
        (game.homeTeam.name === eventRow.homeTeamName && game.awayTeam.name === eventRow.awayTeamName)
        || (game.homeTeam.name === eventRow.awayTeamName && game.awayTeam.name === eventRow.homeTeamName),
    ),
  );

  await upsertEvidence(db, {
    eventId,
    type: "form_guide",
    payload: deriveBasketballFormGuide(homeStats, awayStats) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "h2h",
    payload: deriveBasketballH2H(
      eventRow.homeTeamName,
      eventRow.awayTeamName,
      h2hStats,
    ) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId,
    type: "points_over_under",
    payload: derivePointsOverUnder(homeStats, awayStats) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  let homeSpotlight: BasketballPlayerSpotlight | undefined;
  let awaySpotlight: BasketballPlayerSpotlight | undefined;

  try {
    const homePlayerStats = await provider.getPlayerGameStatsByTeam(eventRow.homeTeamProviderId);
    const awayPlayerStats = await provider.getPlayerGameStatsByTeam(eventRow.awayTeamProviderId);
    homeSpotlight = buildPlayerSpotlight(homePlayerStats, eventRow.homeTeamName);
    awaySpotlight = buildPlayerSpotlight(awayPlayerStats, eventRow.awayTeamName);
  } catch {
    homeSpotlight = undefined;
    awaySpotlight = undefined;
  }

  await upsertEvidence(db, {
    eventId,
    type: "player_spotlight",
    payload: derivePlayerSpotlight(homeSpotlight, awaySpotlight) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  const standings = await provider.getStandings(new Date().getFullYear());
  const homeStanding = standings.find((row) => row.teamName === eventRow.homeTeamName);
  const awayStanding = standings.find((row) => row.teamName === eventRow.awayTeamName);
  const games = await provider.getGamesByDate(new Date());
  const game = games.find((row) => String(row.gameId) === eventRow.providerId);

  await upsertEvidence(db, {
    eventId,
    type: "game_preview",
    payload: deriveGamePreview(game, homeStats, awayStats, homeStanding, awayStanding) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "stats",
    payload: { homeTeam: homeStats, awayTeam: awayStats, sport: "basketball" },
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "ladder",
    payload: { standings, sport: "basketball" },
  });

  const response = await buildInsightResponse(db, eventId);
  if (response) {
    await cache.setInsightPayload(eventId, response, CACHE_TTL.insights);
  }

  await writeAuditLog(db, "compute_basketball_insights", "events", eventId);
  console.log(`Computed basketball insights for event ${eventId}`);
}
