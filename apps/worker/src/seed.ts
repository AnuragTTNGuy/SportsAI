import "dotenv/config";
import { createDb } from "@sports-insights/db";
import { createCacheClient } from "@sports-insights/cache";
import {
  upsertCompetition,
  upsertEvent,
  upsertEvidence,
  upsertTeam,
  writeAuditLog,
} from "@sports-insights/evidence";
import { deriveBothTeamsToScoreTrend, deriveFormGuide, deriveH2H } from "@sports-insights/derive";
import { buildInsightResponse } from "@sports-insights/evidence";
import { CACHE_TTL } from "@sports-insights/shared";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const { db, close } = createDb(databaseUrl);
  const cache = createCacheClient(redisUrl);

  const competition = await upsertCompetition(db, {
    provider: "seed",
    providerId: "epl",
    name: "Premier League",
    sport: "football",
  });

  const homeTeam = await upsertTeam(db, {
    provider: "seed",
    providerId: "team-home",
    name: "Arsenal",
    shortName: "ARS",
    sport: "football",
  });

  const awayTeam = await upsertTeam(db, {
    provider: "seed",
    providerId: "team-away",
    name: "Chelsea",
    shortName: "CHE",
    sport: "football",
  });

  const event = await upsertEvent(
    db,
    {
      provider: "seed",
      providerId: "event-1",
      competitionProviderId: "epl",
      homeTeam: {
        provider: "seed",
        providerId: "team-home",
        name: "Arsenal",
        sport: "football",
      },
      awayTeam: {
        provider: "seed",
        providerId: "team-away",
        name: "Chelsea",
        sport: "football",
      },
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "Scheduled",
      sport: "football",
    },
    competition.id,
    homeTeam.id,
    awayTeam.id,
  );

  const homeResults = [
    { opponent: "Liverpool", result: "W" as const, goalsFor: 2, goalsAgainst: 1, date: new Date().toISOString() },
    { opponent: "Tottenham", result: "D" as const, goalsFor: 1, goalsAgainst: 1, date: new Date().toISOString() },
    { opponent: "Brighton", result: "W" as const, goalsFor: 3, goalsAgainst: 0, date: new Date().toISOString() },
  ];

  const awayResults = [
    { opponent: "West Ham", result: "L" as const, goalsFor: 0, goalsAgainst: 2, date: new Date().toISOString() },
    { opponent: "Everton", result: "W" as const, goalsFor: 2, goalsAgainst: 1, date: new Date().toISOString() },
    { opponent: "Fulham", result: "D" as const, goalsFor: 1, goalsAgainst: 1, date: new Date().toISOString() },
  ];

  const homeStats = {
    team: { provider: "seed", providerId: "team-home", name: "Arsenal", sport: "football" },
    recentResults: homeResults,
    goalsScored: 6,
    goalsConceded: 2,
    bothTeamsScoredRate: 0.67,
  };

  const awayStats = {
    team: { provider: "seed", providerId: "team-away", name: "Chelsea", sport: "football" },
    recentResults: awayResults,
    goalsScored: 3,
    goalsConceded: 4,
    bothTeamsScoredRate: 0.5,
  };

  await upsertEvidence(db, {
    eventId: event.id,
    type: "form_guide",
    payload: deriveFormGuide(homeStats, awayStats) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId: event.id,
    type: "h2h",
    payload: deriveH2H("Arsenal", "Chelsea", {
      homeTeamWins: 3,
      awayTeamWins: 1,
      draws: 1,
      meetings: [
        {
          date: new Date().toISOString(),
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeScore: 2,
          awayScore: 1,
          winner: "home",
        },
      ],
    }) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId: event.id,
    type: "trend",
    payload: deriveBothTeamsToScoreTrend(homeStats, awayStats) as unknown as Record<string, unknown>,
  });

  await upsertEvidence(db, {
    eventId: event.id,
    type: "stats",
    payload: { homeTeam: homeStats, awayTeam: awayStats },
  });

  await upsertEvidence(db, {
    eventId: event.id,
    type: "ladder",
    payload: {
      competitionId: competition.id,
      standings: [
        { teamName: "Arsenal", position: 1, points: 45 },
        { teamName: "Chelsea", position: 4, points: 38 },
      ],
    },
  });

  await upsertEvidence(db, {
    eventId: event.id,
    type: "lineup",
    payload: {
      lineups: [
        {
          team: homeStats.team,
          formation: "4-3-3",
          players: [{ name: "Saka", position: "F", number: 7 }],
          confirmed: true,
        },
      ],
      confirmed: true,
    },
  });

  const response = await buildInsightResponse(db, event.id);
  if (response) {
    await cache.setInsightPayload(event.id, response, CACHE_TTL.insights);
  }

  await writeAuditLog(db, "seed_data", "events", event.id);

  console.log("Seed complete.");
  console.log(`Event ID: ${event.id}`);
  console.log(`Try: curl -H "X-API-Key: dev-key-1" http://localhost:3000/v1/events/${event.id}/insights`);

  await cache.disconnect();
  await close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
