import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDb, areas, competitions } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import {
  upsertCompetition,
  upsertEvent,
  upsertEvidence,
  upsertTeam,
  writeAuditLog,
  buildInsightResponse,
} from "@sports-insights/evidence";
import type { BasketballHeadToHeadStats, BasketballPlayerSpotlight, BasketballTeamStats } from "@sports-insights/normalise";
import { deriveSpreadCover, deriveTeamTotal } from "@sports-insights/derive";
import { CACHE_TTL } from "@sports-insights/shared";

function buildFormGuidePayload(homeStats: BasketballTeamStats, awayStats: BasketballTeamStats) {
  const toTeam = (stats: BasketballTeamStats) => ({
    name: stats.team.name,
    results: stats.recentResults.map((r) => r.result),
    pointsFor: stats.recentResults.reduce((sum, r) => sum + r.pointsFor, 0),
    pointsAgainst: stats.recentResults.reduce((sum, r) => sum + r.pointsAgainst, 0),
    avgPointsFor: stats.avgPointsFor,
    avgPointsAgainst: stats.avgPointsAgainst,
  });

  return { matchCount: 5, teams: [toTeam(homeStats), toTeam(awayStats)] };
}

function buildH2HPayload(homeName: string, awayName: string, h2h: BasketballHeadToHeadStats) {
  return {
    summary: `${homeName} ${h2h.homeTeamWins}-${h2h.awayTeamWins} vs ${awayName} (${h2h.meetings.length} meetings, avg ${h2h.avgTotalPoints} pts)`,
    stats: {
      homeTeamWins: h2h.homeTeamWins,
      awayTeamWins: h2h.awayTeamWins,
      meetings: h2h.meetings.length,
      avgTotalPoints: h2h.avgTotalPoints,
    },
  };
}

function buildPointsOverUnderPayload(homeStats: BasketballTeamStats, awayStats: BasketballTeamStats) {
  const line = 220.5;
  const overRate = (results: BasketballTeamStats["recentResults"]) =>
    results.filter((r) => r.pointsFor + r.pointsAgainst > line).length / (results.length || 1);
  const homeOver = overRate(homeStats.recentResults);
  const awayOver = overRate(awayStats.recentResults);
  const combinedOver = (homeOver + awayOver) / 2;

  return {
    metric: "points_over_under",
    line,
    overRate: combinedOver,
    underRate: 1 - combinedOver,
    label: `${Math.round(combinedOver * 100)}% of recent combined games went Over ${line} points`,
    homeTeam: { overRate: homeOver, avgTotalPoints: 224.5 },
    awayTeam: { overRate: awayOver, avgTotalPoints: 221.0 },
    recommendation: combinedOver >= 0.55 ? "over" : combinedOver <= 0.45 ? "under" : "neutral",
  };
}

function buildPlayerSpotlightPayload(
  homeSpotlight: BasketballPlayerSpotlight,
  awaySpotlight: BasketballPlayerSpotlight,
) {
  const top = homeSpotlight.avgPoints >= awaySpotlight.avgPoints ? homeSpotlight : awaySpotlight;
  return {
    metric: "player_spotlight",
    homePlayer: homeSpotlight,
    awayPlayer: awaySpotlight,
    label: `${top.fullName} averaging ${top.avgPoints} PPG over last ${top.lastGames.length} games`,
  };
}

function buildGamePreviewPayload(homeName: string, awayName: string) {
  return {
    metric: "game_preview",
    venueName: "Crypto.com Arena",
    channel: "ESPN",
    homeRecord: "45-20",
    awayRecord: "52-14",
    homeAvgPoints: 113.6,
    awayAvgPoints: 118.4,
    homeConferenceRank: 3,
    awayConferenceRank: 1,
    label: `${homeName} (45-20) vs ${awayName} (52-14)`,
  };
}

function buildResults(variant: number, opponentPrefix: string): BasketballTeamStats["recentResults"] {
  return [
    { opponent: `${opponentPrefix} A`, result: "W", pointsFor: 118 + variant, pointsAgainst: 110, date: new Date().toISOString(), homeOrAway: "HOME" },
    { opponent: `${opponentPrefix} B`, result: "L", pointsFor: 102, pointsAgainst: 111, date: new Date().toISOString(), homeOrAway: "AWAY" },
    { opponent: `${opponentPrefix} C`, result: "W", pointsFor: 125, pointsAgainst: 119, date: new Date().toISOString(), homeOrAway: "HOME" },
    { opponent: `${opponentPrefix} D`, result: "W", pointsFor: 114, pointsAgainst: 108, date: new Date().toISOString(), homeOrAway: "AWAY" },
    { opponent: `${opponentPrefix} E`, result: "L", pointsFor: 109, pointsAgainst: 115, date: new Date().toISOString(), homeOrAway: "HOME" },
  ];
}

function buildTeamStats(team: { id: string; name: string }, opponentPrefix: string, variant: number): BasketballTeamStats {
  const recentResults = buildResults(variant, opponentPrefix);
  const pointsScored = recentResults.reduce((sum, r) => sum + r.pointsFor, 0);
  const pointsConceded = recentResults.reduce((sum, r) => sum + r.pointsAgainst, 0);
  const count = recentResults.length;

  return {
    team: { provider: "nba.com", providerId: team.id, name: team.name, sport: "basketball" },
    recentResults,
    pointsScored,
    pointsConceded,
    avgPointsFor: Math.round((pointsScored / count) * 10) / 10,
    avgPointsAgainst: Math.round((pointsConceded / count) * 10) / 10,
  };
}

function buildH2H(homeName: string, awayName: string): BasketballHeadToHeadStats {
  return {
    homeTeamWins: 2,
    awayTeamWins: 1,
    avgTotalPoints: 224.5,
    meetings: [
      { date: new Date().toISOString(), homeTeam: homeName, awayTeam: awayName, homeScore: 112, awayScore: 108, winner: "home" },
      { date: new Date().toISOString(), homeTeam: awayName, awayTeam: homeName, homeScore: 115, awayScore: 110, winner: "home" },
      { date: new Date().toISOString(), homeTeam: homeName, awayTeam: awayName, homeScore: 120, awayScore: 117, winner: "home" },
    ],
  };
}

function buildSpotlight(teamName: string, playerName: string, playerId: number): BasketballPlayerSpotlight {
  const lastGames = [32, 28, 35, 24, 31].map((points, index) => ({
    playerId,
    fullName: playerName,
    position: "SF",
    gameDate: new Date(Date.now() - index * 86400000).toISOString(),
    opponent: `OPP-${index + 1}`,
    points,
    rebounds: 7,
    assists: 5,
    minutes: 34,
  }));

  return {
    playerId,
    fullName: playerName,
    position: "SF",
    teamName,
    lastGames,
    avgPoints: 30,
    avgRebounds: 7,
    avgAssists: 5,
  };
}

async function seedNbaDetailTables(
  db: ReturnType<typeof createDb>["db"],
  eventId: string,
  scheduledAt: Date,
  homeTeamUuid: string,
  awayTeamUuid: string,
) {
  try {
    const {
      nbaGames,
      nbaPlayers,
      nbaStandings,
      nbaTeamProfiles,
      nbaTeamSeasonStats,
      nbaVenues,
    } = await import("@sports-insights/db");

    await db.insert(nbaVenues).values({ venueId: 1001, name: "Crypto.com Arena", city: "Los Angeles", state: "CA" }).onConflictDoNothing();
    // Team IDs match stats.nba.com / nba_api (Lakers 1610612747, Celtics 1610612738)
    await db.insert(nbaTeamProfiles).values([
      { teamId: 1610612747, teamUuid: homeTeamUuid, key: "LAL", name: "Los Angeles Lakers", city: "Los Angeles", conference: "Western", division: "Pacific", primaryColor: "#552583", secondaryColor: "#FDB927", venueId: 1001 },
      { teamId: 1610612738, teamUuid: awayTeamUuid, key: "BOS", name: "Boston Celtics", city: "Boston", conference: "Eastern", division: "Atlantic", primaryColor: "#007A33", secondaryColor: "#BA9653" },
    ]).onConflictDoNothing();
    await db.insert(nbaPlayers).values([
      { playerId: 2544, teamId: 1610612747, firstName: "LeBron", lastName: "James", fullName: "LeBron James", position: "SF", jerseyNumber: 23 },
      { playerId: 1628369, teamId: 1610612738, firstName: "Jayson", lastName: "Tatum", fullName: "Jayson Tatum", position: "SF", jerseyNumber: 0 },
    ]).onConflictDoNothing();
    await db.insert(nbaGames).values({
      gameId: 20022001,
      eventId,
      seasonYear: 2024,
      seasonType: "REG",
      gameDate: scheduledAt.toISOString().slice(0, 10),
      gameDatetime: scheduledAt,
      homeTeamId: 1610612747,
      awayTeamId: 1610612738,
      venueId: 1001,
      status: "Scheduled",
      channel: "ESPN",
    }).onConflictDoNothing();
    await db.insert(nbaStandings).values([
      { teamId: 1610612747, seasonYear: 2024, wins: 45, losses: 20, winPct: "0.692", conferenceRank: 3 },
      { teamId: 1610612738, seasonYear: 2024, wins: 52, losses: 14, winPct: "0.788", conferenceRank: 1 },
    ]).onConflictDoNothing();
    await db.insert(nbaTeamSeasonStats).values([
      { teamId: 1610612747, seasonYear: 2024, gamesPlayed: 65, wins: 45, losses: 20, pointsPerGame: "113.5", opponentPointsPerGame: "110.2" },
      { teamId: 1610612738, seasonYear: 2024, gamesPlayed: 66, wins: 52, losses: 14, pointsPerGame: "118.4", opponentPointsPerGame: "107.8" },
    ]).onConflictDoNothing();
  } catch (error) {
    console.warn("Skipped NBA detail tables (run npm run db:migrate if needed):", (error as Error).message);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const { db, close } = createDb(databaseUrl);
  const cache = createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");

  const [createdArea] = await db.insert(areas).values({
    name: "North America",
    countryCode: "US",
    sport: "basketball",
    provider: "nba.com",
    providerId: "nba-area",
  }).onConflictDoUpdate({
    target: [areas.provider, areas.providerId],
    set: { name: "North America", countryCode: "US", sport: "basketball" },
  }).returning();

  const competition = await upsertCompetition(db, {
    provider: "nba.com",
    providerId: "nba",
    areaProviderId: "nba-area-1",
    name: "NBA",
    sport: "basketball",
    key: "NBA",
    competitionType: "League",
    format: "Regular Season",
  });

  await db.update(competitions)
    .set({ areaId: createdArea.id, sport: "basketball" })
    .where(eq(competitions.id, competition.id));

  // Use stats.nba.com team IDs so live compute (nba.com provider) can refresh this event
  const LAL_ID = "1610612747";
  const BOS_ID = "1610612738";

  const home = await upsertTeam(db, {
    provider: "nba.com",
    providerId: LAL_ID,
    name: "Los Angeles Lakers",
    shortName: "LAL",
    sport: "basketball",
  });

  const away = await upsertTeam(db, {
    provider: "nba.com",
    providerId: BOS_ID,
    name: "Boston Celtics",
    shortName: "BOS",
    sport: "basketball",
  });

  const scheduledAt = new Date(Date.now() + 86400000);
  const event = await upsertEvent(
    db,
    {
      provider: "nba.com",
      providerId: "0022400001",
      competitionProviderId: "nba",
      homeTeam: { provider: "nba.com", providerId: LAL_ID, name: home.name, sport: "basketball" },
      awayTeam: { provider: "nba.com", providerId: BOS_ID, name: away.name, sport: "basketball" },
      scheduledAt,
      status: "Scheduled",
      sport: "basketball",
    },
    competition.id,
    home.id,
    away.id,
  );

  await seedNbaDetailTables(db, event.id, scheduledAt, home.id, away.id);

  const homeStats = buildTeamStats({ id: LAL_ID, name: home.name }, "West", 2);
  const awayStats = buildTeamStats({ id: BOS_ID, name: away.name }, "East", 1);
  const h2hStats = buildH2H(home.name, away.name);
  const homeSpotlight = buildSpotlight(home.name, "LeBron James", 2544);
  const awaySpotlight = buildSpotlight(away.name, "Jayson Tatum", 1628369);

  await upsertEvidence(db, { eventId: event.id, type: "form_guide", payload: buildFormGuidePayload(homeStats, awayStats) as unknown as Record<string, unknown> });
  await upsertEvidence(db, { eventId: event.id, type: "h2h", payload: buildH2HPayload(home.name, away.name, h2hStats) as unknown as Record<string, unknown> });
  await upsertEvidence(db, { eventId: event.id, type: "points_over_under", payload: buildPointsOverUnderPayload(homeStats, awayStats) as unknown as Record<string, unknown> });
  await upsertEvidence(db, { eventId: event.id, type: "spread_cover", payload: deriveSpreadCover(homeStats, awayStats, h2hStats) as unknown as Record<string, unknown> });
  await upsertEvidence(db, { eventId: event.id, type: "team_total", payload: deriveTeamTotal(homeStats, awayStats) as unknown as Record<string, unknown> });
  await upsertEvidence(db, { eventId: event.id, type: "player_spotlight", payload: buildPlayerSpotlightPayload(homeSpotlight, awaySpotlight) as unknown as Record<string, unknown> });
  await upsertEvidence(db, { eventId: event.id, type: "game_preview", payload: buildGamePreviewPayload(home.name, away.name) as unknown as Record<string, unknown> });
  await upsertEvidence(db, { eventId: event.id, type: "stats", payload: { homeTeam: homeStats, awayTeam: awayStats, sport: "basketball" } });
  await upsertEvidence(db, { eventId: event.id, type: "ladder", payload: { sport: "basketball" } });

  const response = await buildInsightResponse(db, event.id);
  if (response) {
    await cache.setInsightPayload(event.id, response, CACHE_TTL.insights);
  }

  await writeAuditLog(db, "seed_basketball", "events", event.id);
  console.log(`Seeded basketball demo: ${home.name} vs ${away.name} (${event.id})`);
  await cache.disconnect();
  await close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
