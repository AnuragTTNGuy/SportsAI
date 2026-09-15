import "dotenv/config";
import { eq } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { createDb, competitions } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import type { CacheClient } from "@sports-insights/cache";
import {
  upsertCompetition,
  upsertEvent,
  upsertEvidence,
  upsertTeam,
  writeAuditLog,
  buildInsightResponse,
} from "@sports-insights/evidence";
import {
  deriveBothTeamsToScoreTrend,
  deriveFormGuide,
  deriveH2H,
  deriveOverUnder25,
  deriveCorrectScore,
  deriveHalfResults,
} from "@sports-insights/derive";
import type { CanonicalTeamStats } from "@sports-insights/normalise";
import { CACHE_TTL } from "@sports-insights/shared";

interface DemoMatch {
  competitionName: string;
  competitionProviderId?: string;
  eventId: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  homeShort?: string;
  awayShort?: string;
}

function buildDemoStats(
  home: { id: string; name: string },
  away: { id: string; name: string },
  variant: number,
): { homeStats: CanonicalTeamStats; awayStats: CanonicalTeamStats; h2hStats: ReturnType<typeof buildH2H> } {
  const homeResults = [
    { opponent: away.name, result: "W" as const, goalsFor: 2 + variant, goalsAgainst: 1, goalsForHt: 1, goalsAgainstHt: 0, date: new Date().toISOString() },
    { opponent: "Opponent A", result: "D" as const, goalsFor: 1, goalsAgainst: 1, goalsForHt: 0, goalsAgainstHt: 1, date: new Date().toISOString() },
    { opponent: "Opponent B", result: "W" as const, goalsFor: 3, goalsAgainst: variant, goalsForHt: 2, goalsAgainstHt: 0, date: new Date().toISOString() },
    { opponent: "Opponent E", result: "L" as const, goalsFor: 0, goalsAgainst: 2, goalsForHt: 0, goalsAgainstHt: 1, date: new Date().toISOString() },
    { opponent: "Opponent F", result: "W" as const, goalsFor: 2, goalsAgainst: 0, goalsForHt: 1, goalsAgainstHt: 0, date: new Date().toISOString() },
  ];

  const awayResults = [
    { opponent: home.name, result: "L" as const, goalsFor: 0, goalsAgainst: 2, goalsForHt: 0, goalsAgainstHt: 1, date: new Date().toISOString() },
    { opponent: "Opponent C", result: "W" as const, goalsFor: 2, goalsAgainst: 1, goalsForHt: 1, goalsAgainstHt: 0, date: new Date().toISOString() },
    { opponent: "Opponent D", result: "D" as const, goalsFor: 1, goalsAgainst: 1, goalsForHt: 1, goalsAgainstHt: 1, date: new Date().toISOString() },
    { opponent: "Opponent G", result: "W" as const, goalsFor: 3, goalsAgainst: 2, goalsForHt: 2, goalsAgainstHt: 1, date: new Date().toISOString() },
    { opponent: "Opponent H", result: "L" as const, goalsFor: 1, goalsAgainst: 3, goalsForHt: 0, goalsAgainstHt: 2, date: new Date().toISOString() },
  ];

  const homeStats: CanonicalTeamStats = {
    team: { provider: "seed", providerId: home.id, name: home.name, sport: "football" },
    recentResults: homeResults,
    goalsScored: homeResults.reduce((sum, r) => sum + r.goalsFor, 0),
    goalsConceded: homeResults.reduce((sum, r) => sum + r.goalsAgainst, 0),
    bothTeamsScoredRate: 0.55 + variant * 0.05,
  };

  const awayStats: CanonicalTeamStats = {
    team: { provider: "seed", providerId: away.id, name: away.name, sport: "football" },
    recentResults: awayResults,
    goalsScored: awayResults.reduce((sum, r) => sum + r.goalsFor, 0),
    goalsConceded: awayResults.reduce((sum, r) => sum + r.goalsAgainst, 0),
    bothTeamsScoredRate: 0.45 + variant * 0.05,
  };

  const h2hStats = buildH2H(home.name, away.name, variant);

  return { homeStats, awayStats, h2hStats };
}

function buildH2H(homeName: string, awayName: string, variant: number) {
  return {
    homeTeamWins: 2 + variant,
    awayTeamWins: 1,
    draws: 1,
    meetings: [
      {
        date: new Date().toISOString(),
        homeTeam: homeName,
        awayTeam: awayName,
        homeScore: 2,
        awayScore: 1,
        homeScoreHt: 1,
        awayScoreHt: 0,
        winner: "home" as const,
      },
      {
        date: new Date().toISOString(),
        homeTeam: awayName,
        awayTeam: homeName,
        homeScore: 1,
        awayScore: 1,
        homeScoreHt: 0,
        awayScoreHt: 1,
        winner: "draw" as const,
      },
      {
        date: new Date().toISOString(),
        homeTeam: homeName,
        awayTeam: awayName,
        homeScore: 2 + variant,
        awayScore: 1,
        homeScoreHt: 1,
        awayScoreHt: 0,
        winner: "home" as const,
      },
    ],
  };
}

async function seedEventInsights(
  db: Database,
  cache: CacheClient,
  eventId: string,
  competitionId: string,
  homeStats: CanonicalTeamStats,
  awayStats: CanonicalTeamStats,
  h2hStats: ReturnType<typeof buildH2H>,
) {
  await upsertEvidence(db, {
    eventId,
    type: "form_guide",
    payload: deriveFormGuide(homeStats, awayStats) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId,
    type: "h2h",
    payload: deriveH2H(homeStats.team.name, awayStats.team.name, h2hStats) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId,
    type: "trend",
    payload: deriveBothTeamsToScoreTrend(homeStats, awayStats) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId,
    type: "over_under",
    payload: deriveOverUnder25(homeStats, awayStats) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId,
    type: "correct_score",
    payload: deriveCorrectScore(homeStats, awayStats, h2hStats) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId,
    type: "half_results",
    payload: deriveHalfResults(homeStats, awayStats, h2hStats, homeStats.team.name) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId,
    type: "stats",
    payload: { homeTeam: homeStats, awayTeam: awayStats },
  });

  await upsertEvidence(db, {
    eventId,
    type: "ladder",
    payload: {
      competitionId,
      standings: [
        { teamName: homeStats.team.name, position: 1, points: 45 },
        { teamName: awayStats.team.name, position: 2, points: 40 },
      ],
    },
  });

  await upsertEvidence(db, {
    eventId,
    type: "lineup",
    payload: {
      lineups: [
        {
          team: homeStats.team,
          formation: "4-3-3",
          players: [{ name: `${homeStats.team.name} Player`, position: "F", number: 9 }],
          confirmed: true,
        },
        {
          team: awayStats.team,
          formation: "4-2-3-1",
          players: [{ name: `${awayStats.team.name} Player`, position: "F", number: 10 }],
          confirmed: true,
        },
      ],
      confirmed: true,
    },
  });

  const response = await buildInsightResponse(db, eventId);
  if (response) {
    await cache.setInsightPayload(eventId, response, CACHE_TTL.insights);
  }
}

async function seedDemoMatch(
  db: Database,
  cache: CacheClient,
  match: DemoMatch,
  variant: number,
) {
  let competitionRow;

  if (match.competitionProviderId) {
    competitionRow = await upsertCompetition(db, {
      provider: "seed",
      providerId: match.competitionProviderId,
      areaProviderId: "seed-area",
      name: match.competitionName,
      sport: "football",
    });
  } else {
    competitionRow = await db.query.competitions.findFirst({
      where: eq(competitions.name, match.competitionName),
    });
  }

  if (!competitionRow) {
    console.warn(`Skipping demo match — competition not found: ${match.competitionName}`);
    return null;
  }

  const home = await upsertTeam(db, {
    provider: "seed",
    providerId: match.homeId,
    name: match.home,
    shortName: match.homeShort,
    sport: "football",
  });

  const away = await upsertTeam(db, {
    provider: "seed",
    providerId: match.awayId,
    name: match.away,
    shortName: match.awayShort,
    sport: "football",
  });

  const event = await upsertEvent(
    db,
    {
      provider: "seed",
      providerId: match.eventId,
      competitionProviderId: competitionRow.providerId,
      homeTeam: { provider: "seed", providerId: match.homeId, name: match.home, sport: "football" },
      awayTeam: { provider: "seed", providerId: match.awayId, name: match.away, sport: "football" },
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "Scheduled",
      sport: "football",
    },
    competitionRow.id,
    home.id,
    away.id,
  );

  const { homeStats, awayStats, h2hStats } = buildDemoStats(
    { id: match.homeId, name: match.home },
    { id: match.awayId, name: match.away },
    variant,
  );

  await seedEventInsights(db, cache, event.id, competitionRow.id, homeStats, awayStats, h2hStats);
  await writeAuditLog(db, "seed_data", "events", event.id, { competition: match.competitionName });

  return event.id;
}

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const { db, close } = createDb(databaseUrl);
  const cache = createCacheClient(redisUrl);

  const demoMatches: DemoMatch[] = [
    {
      competitionName: "Premier League",
      competitionProviderId: "epl",
      eventId: "event-1",
      home: "Arsenal",
      away: "Chelsea",
      homeId: "team-home",
      awayId: "team-away",
      homeShort: "ARS",
      awayShort: "CHE",
    },
    {
      competitionName: "La Liga",
      eventId: "demo-laliga-1",
      home: "Real Madrid",
      away: "Barcelona",
      homeId: "rm",
      awayId: "bar",
    },
    {
      competitionName: "Bundesliga",
      eventId: "demo-bundesliga-1",
      home: "Bayern Munich",
      away: "Borussia Dortmund",
      homeId: "bayern",
      awayId: "bvb",
    },
    {
      competitionName: "Serie A",
      eventId: "demo-seriea-1",
      home: "Inter",
      away: "AC Milan",
      homeId: "inter",
      awayId: "milan",
    },
    {
      competitionName: "Ligue 1",
      eventId: "demo-ligue1-1",
      home: "Paris SG",
      away: "Marseille",
      homeId: "psg",
      awayId: "om",
    },
    {
      competitionName: "MLS",
      eventId: "demo-mls-1",
      home: "LAFC",
      away: "Inter Miami",
      homeId: "lafc",
      awayId: "miami",
    },
  ];

  const seededEventIds: string[] = [];

  for (const [index, match] of demoMatches.entries()) {
    const eventId = await seedDemoMatch(db, cache, match, index);
    if (eventId) seededEventIds.push(eventId);
  }

  console.log("Seed complete.");
  console.log(`Seeded ${seededEventIds.length} events with full insights.`);
  for (const [index, eventId] of seededEventIds.entries()) {
    console.log(`  ${demoMatches[index].competitionName}: ${eventId}`);
  }

  await cache.disconnect();
  await close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
