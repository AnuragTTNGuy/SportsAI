import { eq } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import {
  areas,
  competitions,
  rounds,
  seasons,
  statSnapshots,
} from "@sports-insights/db";
import type { AreasCatalogResponse } from "@sports-insights/shared";
import { CACHE_TTL } from "@sports-insights/shared";
import type { CacheClient } from "@sports-insights/cache";
import type { AreasCatalog } from "@sports-insights/normalise";

function parseDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

export async function ingestAreasCatalog(
  db: Database,
  catalog: AreasCatalog,
): Promise<{ areas: number; competitions: number; seasons: number; rounds: number }> {
  let areaCount = 0;
  let competitionCount = 0;
  let seasonCount = 0;
  let roundCount = 0;
  const capturedAt = new Date();

  for (const area of catalog.areas) {
    const [areaRow] = await db
      .insert(areas)
      .values({
        name: area.name,
        countryCode: area.countryCode,
        sport: area.sport,
        provider: area.provider,
        providerId: area.providerId,
        capturedAt,
      })
      .onConflictDoUpdate({
        target: [areas.provider, areas.providerId],
        set: {
          name: area.name,
          countryCode: area.countryCode,
          capturedAt,
        },
      })
      .returning();

    areaCount++;

    for (const comp of area.competitions) {
      const [compRow] = await db
        .insert(competitions)
        .values({
          areaId: areaRow.id,
          name: comp.name,
          sport: comp.sport,
          provider: comp.provider,
          providerId: comp.providerId,
          competitionKey: comp.key,
          gender: comp.gender,
          competitionType: comp.competitionType,
          format: comp.format,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [competitions.provider, competitions.providerId],
          set: {
            areaId: areaRow.id,
            name: comp.name,
            competitionKey: comp.key,
            gender: comp.gender,
            competitionType: comp.competitionType,
            format: comp.format,
            updatedAt: new Date(),
          },
        })
        .returning();

      competitionCount++;

      for (const season of comp.seasons) {
        const [seasonRow] = await db
          .insert(seasons)
          .values({
            competitionId: compRow.id,
            provider: season.provider,
            providerId: season.providerId,
            seasonYear: season.season,
            name: season.name,
            currentSeason: season.currentSeason,
            startDate: parseDate(season.startDate),
            endDate: parseDate(season.endDate),
            capturedAt,
          })
          .onConflictDoUpdate({
            target: [seasons.provider, seasons.providerId],
            set: {
              competitionId: compRow.id,
              seasonYear: season.season,
              name: season.name,
              currentSeason: season.currentSeason,
              startDate: parseDate(season.startDate),
              endDate: parseDate(season.endDate),
              capturedAt,
            },
          })
          .returning();

        seasonCount++;

        for (const round of season.rounds) {
          await db
            .insert(rounds)
            .values({
              seasonId: seasonRow.id,
              provider: round.provider,
              providerId: round.providerId,
              name: round.name,
              roundType: round.roundType,
              currentRound: round.currentRound,
              startDate: parseDate(round.startDate),
              endDate: parseDate(round.endDate),
              capturedAt,
            })
            .onConflictDoUpdate({
              target: [rounds.provider, rounds.providerId],
              set: {
                seasonId: seasonRow.id,
                name: round.name,
                roundType: round.roundType,
                currentRound: round.currentRound,
                startDate: parseDate(round.startDate),
                endDate: parseDate(round.endDate),
                capturedAt,
              },
            });

          roundCount++;
        }
      }
    }
  }

  await db.insert(statSnapshots).values({
    snapshotType: "areas_catalog",
    payload: catalog as unknown as Record<string, unknown>,
    capturedAt,
  });

  return {
    areas: areaCount,
    competitions: competitionCount,
    seasons: seasonCount,
    rounds: roundCount,
  };
}

export async function buildAreasCatalogResponse(db: Database): Promise<AreasCatalogResponse> {
  const areaRows = await db.query.areas.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  const responseAreas = [];

  for (const area of areaRows) {
    const competitionRows = await db.query.competitions.findMany({
      where: eq(competitions.areaId, area.id),
      orderBy: (table, { asc }) => [asc(table.name)],
    });

    const responseCompetitions = [];

    for (const comp of competitionRows) {
      const seasonRows = await db.query.seasons.findMany({
        where: eq(seasons.competitionId, comp.id),
        orderBy: (table, { desc }) => [desc(table.seasonYear)],
      });

      const responseSeasons = [];

      for (const season of seasonRows) {
        const roundRows = await db.query.rounds.findMany({
          where: eq(rounds.seasonId, season.id),
          orderBy: (table, { asc }) => [asc(table.name)],
        });

        responseSeasons.push({
          id: season.id,
          providerId: season.providerId,
          season: season.seasonYear,
          name: season.name,
          currentSeason: season.currentSeason,
          rounds: roundRows.map((round) => ({
            id: round.id,
            providerId: round.providerId,
            name: round.name,
            type: round.roundType ?? undefined,
            currentRound: round.currentRound,
          })),
        });
      }

      responseCompetitions.push({
        id: comp.id,
        providerId: comp.providerId,
        name: comp.name,
        key: comp.competitionKey ?? undefined,
        gender: comp.gender ?? undefined,
        type: comp.competitionType ?? undefined,
        format: comp.format ?? undefined,
        seasons: responseSeasons,
      });
    }

    responseAreas.push({
      id: area.id,
      providerId: area.providerId,
      countryCode: area.countryCode,
      name: area.name,
      competitions: responseCompetitions,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    areas: responseAreas,
  };
}

export async function getAreasCatalog(
  db: Database,
  cache: CacheClient,
): Promise<AreasCatalogResponse> {
  const cached = await cache.getAreasCatalog();
  if (cached) return cached;

  const response = await buildAreasCatalogResponse(db);
  await cache.setAreasCatalog(response, CACHE_TTL.areasCatalog);
  return response;
}
