import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@sports-insights/db";
import { events, teams } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import {
  deriveBasketballFormGuide,
  deriveBasketballH2H,
  deriveGamePreview,
  derivePlayerSpotlight,
  derivePointsOverUnder,
  deriveSpreadCover,
  deriveTeamTotal,
  RECENT_BASKETBALL_FORM_MATCHES,
} from "@sports-insights/derive";
import type { BasketballPlayerSpotlight } from "@sports-insights/normalise";
import {
  createEspnNbaProvider,
  createNbaComProvider,
  deriveBasketballHeadToHeadFromGames,
  getNbaSeasonStartYear,
  type NbaComPlayerGameStat,
  type NbaComProvider,
} from "@sports-insights/provider";
import { CACHE_TTL } from "@sports-insights/shared";
import {
  buildInsightResponse,
  createStatSnapshot,
  upsertEvidence,
  writeAuditLog,
} from "./service.js";

type BasketballStatsProvider = Pick<
  NbaComProvider,
  | "getTeamGameStats"
  | "getHeadToHeadEvents"
  | "getSchedules"
  | "getPlayerGameStatsByTeam"
  | "getStandings"
  | "getGamesByDate"
> & { name: string };

function getNbaComProvider(): BasketballStatsProvider {
  return createNbaComProvider({
    statsBaseUrl: process.env.NBA_STATS_BASE_URL,
    timeoutMs: process.env.NBA_STATS_TIMEOUT_MS
      ? Number(process.env.NBA_STATS_TIMEOUT_MS)
      : undefined,
  });
}

function getEspnProvider(): BasketballStatsProvider {
  return createEspnNbaProvider({
    timeoutMs: process.env.ESPN_NBA_TIMEOUT_MS
      ? Number(process.env.ESPN_NBA_TIMEOUT_MS)
      : undefined,
  });
}

function resolvePreferredProvider(): BasketballStatsProvider {
  const preferred = (process.env.NBA_PROVIDER ?? "auto").toLowerCase();
  if (preferred === "espn") return getEspnProvider();
  return getNbaComProvider();
}

function buildPlayerSpotlight(
  playerStats: NbaComPlayerGameStat[],
  teamName: string,
): BasketballPlayerSpotlight | undefined {
  if (playerStats.length === 0) return undefined;

  const byPlayer = new Map<number, NbaComPlayerGameStat[]>();
  for (const row of playerStats) {
    const list = byPlayer.get(row.PlayerID) ?? [];
    list.push(row);
    byPlayer.set(row.PlayerID, list);
  }

  let best: BasketballPlayerSpotlight | undefined;

  for (const [playerId, rows] of byPlayer) {
    const sorted = [...rows]
      .sort((a, b) => new Date(b.Day).getTime() - new Date(a.Day).getTime())
      .slice(0, 5);
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

async function computeBasketballInsightsWithProvider(
  db: Database,
  cache: CacheClient,
  eventId: string,
  provider: BasketballStatsProvider,
): Promise<boolean> {
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
      homeScore: events.homeScore,
      awayScore: events.awayScore,
      scheduledAt: events.scheduledAt,
      status: events.status,
    })
    .from(events)
    .innerJoin(homeTeamAlias, eq(events.homeTeamId, homeTeamAlias.id))
    .innerJoin(awayTeamAlias, eq(events.awayTeamId, awayTeamAlias.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!eventRow) return false;

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

  let h2hEvents = await provider.getHeadToHeadEvents(
    eventRow.homeTeamProviderId,
    eventRow.awayTeamProviderId,
  );
  if (h2hEvents.length === 0) {
    const competitionEvents = await provider.getSchedules("nba", eventRow.scheduledAt);
    h2hEvents = competitionEvents.filter(
      (game) =>
        (game.homeTeam.name === eventRow.homeTeamName && game.awayTeam.name === eventRow.awayTeamName)
        || (game.homeTeam.name === eventRow.awayTeamName && game.awayTeam.name === eventRow.homeTeamName),
    );
  }
  const h2hStats = deriveBasketballHeadToHeadFromGames(eventRow.homeTeamName, h2hEvents);

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

  await upsertEvidence(db, {
    eventId,
    type: "spread_cover",
    payload: deriveSpreadCover(homeStats, awayStats, h2hStats) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "team_total",
    payload: deriveTeamTotal(homeStats, awayStats) as unknown as Record<string, unknown>,
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

  const standings = await provider.getStandings(getNbaSeasonStartYear(eventRow.scheduledAt));
  const homeStanding = standings.find((row) => row.teamName === eventRow.homeTeamName);
  const awayStanding = standings.find((row) => row.teamName === eventRow.awayTeamName);

  let game;
  try {
    const games = await provider.getGamesByDate(eventRow.scheduledAt);
    game = games.find((row) => String(row.gameId).padStart(10, "0") === eventRow.providerId.padStart(10, "0"))
      ?? games.find((row) =>
        row.homeTeamId === Number(eventRow.homeTeamProviderId)
        && row.awayTeamId === Number(eventRow.awayTeamProviderId)
      );
  } catch {
    game = undefined;
  }

  if (!game) {
    game = {
      gameId: Number(eventRow.providerId) || 0,
      seasonYear: getNbaSeasonStartYear(eventRow.scheduledAt),
      seasonType: "REG",
      gameDate: eventRow.scheduledAt.toISOString().slice(0, 10),
      gameDatetime: eventRow.scheduledAt.toISOString(),
      homeTeamId: Number(eventRow.homeTeamProviderId),
      awayTeamId: Number(eventRow.awayTeamProviderId),
      homeTeamKey: "",
      awayTeamKey: "",
      homeTeamName: eventRow.homeTeamName,
      awayTeamName: eventRow.awayTeamName,
      homeScore: eventRow.homeScore ?? undefined,
      awayScore: eventRow.awayScore ?? undefined,
      status: eventRow.status,
    };
  }

  await upsertEvidence(db, {
    eventId,
    type: "game_preview",
    payload: deriveGamePreview(game, homeStats, awayStats, homeStanding, awayStanding) as unknown as Record<string, unknown>,
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "stats",
    payload: { homeTeam: homeStats, awayTeam: awayStats, sport: "basketball", source: provider.name },
    sourceStatIds: [homeSnapshot.id, awaySnapshot.id],
  });

  await upsertEvidence(db, {
    eventId,
    type: "ladder",
    payload: { standings, sport: "basketball", source: provider.name },
  });

  const response = await buildInsightResponse(db, eventId);
  if (response && response.cards.length > 0) {
    await cache.setInsightPayload(eventId, response, CACHE_TTL.insights);
  }

  await writeAuditLog(db, "compute_basketball_insights", "events", eventId, { source: provider.name });
  console.log(`Computed basketball insights for event ${eventId} (${provider.name})`);
  return Boolean(response && response.cards.length > 0);
}

export async function computeBasketballInsightsForEvent(
  db: Database,
  cache: CacheClient,
  eventId: string,
  provider?: BasketballStatsProvider,
): Promise<boolean> {
  const preferred = provider ?? resolvePreferredProvider();
  try {
    return await computeBasketballInsightsWithProvider(db, cache, eventId, preferred);
  } catch (error) {
    const preferredName = preferred.name;
    if (provider || preferredName === "espn") throw error;

    console.warn(
      `Basketball insight compute via ${preferredName} failed for ${eventId}; falling back to ESPN:`,
      (error as Error).message,
    );
    return computeBasketballInsightsWithProvider(db, cache, eventId, getEspnProvider());
  }
}

export async function ensureBasketballInsights(
  db: Database,
  cache: CacheClient,
  eventId: string,
): Promise<void> {
  await computeBasketballInsightsForEvent(db, cache, eventId);
}
