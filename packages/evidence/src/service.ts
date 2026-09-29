import { and, asc, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@sports-insights/db";
import {
  auditLogs,
  competitions,
  events,
  evidenceRecords,
  lineups,
  standings,
  statSnapshots,
  teams,
} from "@sports-insights/db";
import type { InsightCard, InsightResponse } from "@sports-insights/shared";
import { CACHE_TTL } from "@sports-insights/shared";
import type { CacheClient } from "@sports-insights/cache";
import type { CanonicalCompetition, CanonicalEvent, CanonicalLineup, CanonicalStanding } from "@sports-insights/normalise";
import { computeExpiryDate, getEvidenceTtl, type NewEvidenceInput } from "./create.js";
import { filterValidEvidence } from "./validate.js";
import { buildBasketballInsightCards } from "./basketball.js";

export async function upsertCompetition(db: Database, comp: CanonicalCompetition) {
  const existing = await db.query.competitions.findFirst({
    where: and(eq(competitions.provider, comp.provider), eq(competitions.providerId, comp.providerId)),
  });

  if (existing) {
    await db.update(competitions).set({
      name: comp.name,
      sport: comp.sport,
      competitionKey: comp.key,
      gender: comp.gender,
      competitionType: comp.competitionType,
      format: comp.format,
      updatedAt: new Date(),
    }).where(eq(competitions.id, existing.id));
    return existing;
  }

  const [created] = await db.insert(competitions).values({
    name: comp.name,
    sport: comp.sport,
    provider: comp.provider,
    providerId: comp.providerId,
    competitionKey: comp.key,
    gender: comp.gender,
    competitionType: comp.competitionType,
    format: comp.format,
  }).returning();

  return created!;
}

export async function upsertTeam(
  db: Database,
  team: { provider: string; providerId: string; name: string; shortName?: string; sport: string },
) {
  const existing = await db.query.teams.findFirst({
    where: and(eq(teams.provider, team.provider), eq(teams.providerId, team.providerId)),
  });

  if (existing) {
    await db.update(teams).set({
      name: team.name,
      shortName: team.shortName,
      updatedAt: new Date(),
    }).where(eq(teams.id, existing.id));
    return existing;
  }

  const [created] = await db.insert(teams).values({
    name: team.name,
    shortName: team.shortName,
    sport: team.sport,
    provider: team.provider,
    providerId: team.providerId,
  }).returning();

  return created!;
}

export async function upsertEvent(
  db: Database,
  event: CanonicalEvent,
  competitionId: string,
  homeTeamId: string,
  awayTeamId: string,
) {
  const existing = await db.query.events.findFirst({
    where: and(eq(events.provider, event.provider), eq(events.providerId, event.providerId)),
  });

  if (existing) {
    await db.update(events).set({
      scheduledAt: event.scheduledAt,
      status: event.status,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      updatedAt: new Date(),
    }).where(eq(events.id, existing.id));
    return existing;
  }

  const [created] = await db.insert(events).values({
    competitionId,
    homeTeamId,
    awayTeamId,
    scheduledAt: event.scheduledAt,
    status: event.status,
    sport: event.sport,
    provider: event.provider,
    providerId: event.providerId,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
  }).returning();

  return created!;
}

export async function replaceStandings(
  db: Database,
  competitionId: string,
  rows: CanonicalStanding[],
  teamIdMap: Map<string, string>,
) {
  const capturedAt = new Date();
  await db.delete(standings).where(eq(standings.competitionId, competitionId));

  if (rows.length === 0) return;

  await db.insert(standings).values(
    rows.map((row) => ({
      competitionId,
      teamId: teamIdMap.get(row.team.providerId)!,
      position: row.position,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
      capturedAt,
    })),
  );
}

export async function replaceLineups(
  db: Database,
  eventId: string,
  lineupsData: CanonicalLineup[],
  teamIdMap: Map<string, string>,
) {
  await db.delete(lineups).where(eq(lineups.eventId, eventId));

  if (lineupsData.length === 0) return;

  await db.insert(lineups).values(
    lineupsData.map((lineup) => ({
      eventId,
      teamId: teamIdMap.get(lineup.team.providerId)!,
      formation: lineup.formation,
      players: lineup.players,
      confirmed: lineup.confirmed ? 1 : 0,
      capturedAt: new Date(),
    })),
  );
}

export async function createStatSnapshot(
  db: Database,
  input: {
    eventId?: string;
    teamId?: string;
    snapshotType: string;
    payload: Record<string, unknown>;
  },
) {
  const [snapshot] = await db.insert(statSnapshots).values({
    eventId: input.eventId,
    teamId: input.teamId,
    snapshotType: input.snapshotType,
    payload: input.payload,
    capturedAt: new Date(),
  }).returning();

  return snapshot!;
}

export async function upsertEvidence(db: Database, input: NewEvidenceInput) {
  const ttlMinutes = input.ttlMinutes ?? getEvidenceTtl(input.type);
  const expiresAt = computeExpiryDate(ttlMinutes);
  const computedAt = new Date();

  await db.delete(evidenceRecords).where(
    and(eq(evidenceRecords.eventId, input.eventId), eq(evidenceRecords.type, input.type)),
  );

  const [record] = await db.insert(evidenceRecords).values({
    eventId: input.eventId,
    type: input.type,
    payload: input.payload,
    sourceStatIds: input.sourceStatIds ?? [],
    computedAt,
    expiresAt,
  }).returning();

  return record!;
}

export async function getValidatedEvidenceForEvent(db: Database, eventId: string) {
  const records = await db.query.evidenceRecords.findMany({
    where: eq(evidenceRecords.eventId, eventId),
    orderBy: [desc(evidenceRecords.computedAt)],
  });

  return filterValidEvidence(records);
}

export async function buildInsightResponse(
  db: Database,
  eventId: string,
): Promise<InsightResponse | null> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) return null;

  const validEvidence = await getValidatedEvidenceForEvent(db, eventId);
  const evidenceByType = new Map(validEvidence.map((e) => [e.type, e]));
  const statsEvidence = evidenceByType.get("stats");
  const ladderEvidence = evidenceByType.get("ladder");
  const lineupEvidence = evidenceByType.get("lineup");

  if (event.sport === "basketball") {
    const { cards, freshness } = buildBasketballInsightCards(evidenceByType);
    if (lineupEvidence) freshness.lineups = lineupEvidence.computedAt.toISOString();

    return {
      eventId,
      generatedAt: new Date().toISOString(),
      freshness,
      cards,
      stats: statsEvidence?.payload ?? { sport: "basketball" },
      ladder: ladderEvidence?.payload ?? {},
      lineup: lineupEvidence?.payload ?? {},
    };
  }

  const formEvidence = evidenceByType.get("form_guide");
  const h2hEvidence = evidenceByType.get("h2h");
  const trendEvidence = evidenceByType.get("trend");
  const overUnderEvidence = evidenceByType.get("over_under");
  const correctScoreEvidence = evidenceByType.get("correct_score");
  const halfResultsEvidence = evidenceByType.get("half_results");

  const cards: InsightCard[] = [];

  if (formEvidence) {
    cards.push({
      type: "form_guide",
      title: "Recent Form (Last 5)",
      evidenceIds: [formEvidence.id],
      payload: formEvidence.payload,
    });
  }

  if (h2hEvidence) {
    cards.push({
      type: "h2h",
      title: "Head to Head",
      evidenceIds: [h2hEvidence.id],
      payload: h2hEvidence.payload,
    });
  }

  if (trendEvidence) {
    cards.push({
      type: "trend",
      title: "Both Teams to Score",
      evidenceIds: [trendEvidence.id],
      payload: trendEvidence.payload,
    });
  }

  if (overUnderEvidence) {
    cards.push({
      type: "over_under",
      title: "Over / Under 2.5",
      evidenceIds: [overUnderEvidence.id],
      payload: overUnderEvidence.payload,
    });
  }

  if (correctScoreEvidence) {
    cards.push({
      type: "correct_score",
      title: "Correct Score",
      evidenceIds: [correctScoreEvidence.id],
      payload: correctScoreEvidence.payload,
    });
  }

  if (halfResultsEvidence) {
    cards.push({
      type: "half_results",
      title: "Half-Time Results",
      evidenceIds: [halfResultsEvidence.id],
      payload: halfResultsEvidence.payload,
    });
  }

  const freshness: Record<string, string> = {};
  if (formEvidence) freshness.form = formEvidence.computedAt.toISOString();
  if (lineupEvidence) freshness.lineups = lineupEvidence.computedAt.toISOString();
  if (h2hEvidence) freshness.h2h = h2hEvidence.computedAt.toISOString();
  if (overUnderEvidence) freshness.over_under = overUnderEvidence.computedAt.toISOString();
  if (correctScoreEvidence) freshness.correct_score = correctScoreEvidence.computedAt.toISOString();
  if (halfResultsEvidence) freshness.half_results = halfResultsEvidence.computedAt.toISOString();

  return {
    eventId,
    generatedAt: new Date().toISOString(),
    freshness,
    cards,
    stats: statsEvidence?.payload ?? {},
    ladder: ladderEvidence?.payload ?? {},
    lineup: lineupEvidence?.payload ?? {},
  };
}

export async function getInsightResponse(
  db: Database,
  cache: CacheClient,
  eventId: string,
): Promise<InsightResponse | null> {
  const cached = await cache.getInsightPayload(eventId);
  if (cached && cached.cards.length > 0) return cached;

  let response = await buildInsightResponse(db, eventId);
  if (!response) return null;

  if (response.cards.length === 0) {
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (event?.sport === "basketball") {
      try {
        const { ensureBasketballInsights } = await import("./compute-basketball.js");
        await ensureBasketballInsights(db, cache, eventId);
        const refreshed = await buildInsightResponse(db, eventId);
        if (refreshed) response = refreshed;
      } catch (error) {
        console.error(`On-demand basketball insight compute failed for ${eventId}:`, error);
      }
    } else if (event?.sport === "football") {
      try {
        const { ensureFootballInsights } = await import("./compute-football.js");
        await ensureFootballInsights(db, cache, eventId);
        const refreshed = await buildInsightResponse(db, eventId);
        if (refreshed) response = refreshed;
      } catch (error) {
        console.error(`On-demand football insight compute failed for ${eventId}:`, error);
      }
    }
  }

  if (response.cards.length > 0) {
    await cache.setInsightPayload(eventId, response, CACHE_TTL.insights);
  }
  return response;
}

export async function listEventsByDate(
  db: Database,
  date: Date,
  sport = "football",
) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const homeTeamAlias = alias(teams, "home_team");
  const awayTeamAlias = alias(teams, "away_team");

  const rows = await db
    .select({
      id: events.id,
      competitionId: events.competitionId,
      homeTeamId: events.homeTeamId,
      awayTeamId: events.awayTeamId,
      scheduledAt: events.scheduledAt,
      status: events.status,
      sport: events.sport,
      homeTeamName: homeTeamAlias.name,
      awayTeamName: awayTeamAlias.name,
    })
    .from(events)
    .innerJoin(homeTeamAlias, eq(events.homeTeamId, homeTeamAlias.id))
    .innerJoin(awayTeamAlias, eq(events.awayTeamId, awayTeamAlias.id))
    .where(and(
      gte(events.scheduledAt, start),
      lte(events.scheduledAt, end),
      eq(events.sport, sport),
    ));

  return rows.map((row) => ({
    id: row.id,
    competitionId: row.competitionId,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    sport: row.sport,
  }));
}

export async function listEventsByCompetition(
  db: Database,
  competitionName: string,
  sport = "football",
  date?: Date,
  options: { upcomingOnly?: boolean } = {},
) {
  const homeTeamAlias = alias(teams, "home_team");
  const awayTeamAlias = alias(teams, "away_team");

  const conditions = [
    ilike(competitions.name, `%${competitionName}%`),
    eq(events.sport, sport),
    eq(competitions.sport, sport),
  ];

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    conditions.push(gte(events.scheduledAt, start), lte(events.scheduledAt, end));
  }

  const upcomingOnly = options.upcomingOnly ?? true;
  if (upcomingOnly) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    conditions.push(gte(events.scheduledAt, startOfToday));
    conditions.push(sql`lower(${events.status}) not in ('final', 'f/ot', 'completed', 'closed')`);
  }

  const rows = await db
    .select({
      id: events.id,
      competitionId: events.competitionId,
      competitionName: competitions.name,
      homeTeamId: events.homeTeamId,
      awayTeamId: events.awayTeamId,
      scheduledAt: events.scheduledAt,
      status: events.status,
      sport: events.sport,
      homeTeamName: homeTeamAlias.name,
      awayTeamName: awayTeamAlias.name,
    })
    .from(events)
    .innerJoin(competitions, eq(events.competitionId, competitions.id))
    .innerJoin(homeTeamAlias, eq(events.homeTeamId, homeTeamAlias.id))
    .innerJoin(awayTeamAlias, eq(events.awayTeamId, awayTeamAlias.id))
    .where(and(...conditions))
    .orderBy(upcomingOnly ? asc(events.scheduledAt) : desc(events.scheduledAt));

  return rows.map((row) => ({
    id: row.id,
    competitionId: row.competitionId,
    competitionName: row.competitionName,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    sport: row.sport,
  }));
}

export async function getLadderForCompetition(
  db: Database,
  cache: CacheClient,
  competitionId: string,
) {
  const cached = await cache.getLadder(competitionId);
  if (cached) return cached;

  const rows = await db
    .select({
      position: standings.position,
      played: standings.played,
      won: standings.won,
      drawn: standings.drawn,
      lost: standings.lost,
      goalsFor: standings.goalsFor,
      goalsAgainst: standings.goalsAgainst,
      points: standings.points,
      teamName: teams.name,
      capturedAt: standings.capturedAt,
    })
    .from(standings)
    .innerJoin(teams, eq(standings.teamId, teams.id))
    .where(eq(standings.competitionId, competitionId))
    .orderBy(standings.position);

  const payload = {
    competitionId,
    capturedAt: rows[0]?.capturedAt?.toISOString() ?? new Date().toISOString(),
    standings: rows,
  };

  await cache.setLadder(competitionId, payload, CACHE_TTL.ladder);
  return payload;
}

export async function writeAuditLog(
  db: Database,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
    action,
    resourceType,
    resourceId,
    metadata,
  });
}
