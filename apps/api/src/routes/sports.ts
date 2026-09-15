import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { competitions } from "@sports-insights/db";
import { SPORTS, sportsCatalogResponseSchema } from "@sports-insights/shared";
import { writeAuditLog } from "@sports-insights/evidence";

export const sportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/sports", {
    schema: {
      description: "List supported sports and league counts",
      tags: ["Catalog"],
    },
  }, async () => {
    const counts = await fastify.db
      .select({
        sport: competitions.sport,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(competitions)
      .groupBy(competitions.sport);

    const countBySport = new Map(counts.map((row) => [row.sport, row.count]));

    const response = sportsCatalogResponseSchema.parse({
      generatedAt: new Date().toISOString(),
      sports: Object.values(SPORTS).map((sport) => ({
        slug: sport.slug,
        name: sport.name,
        description: sport.description,
        competitionCount: countBySport.get(sport.slug) ?? 0,
      })),
    });

    await writeAuditLog(fastify.db, "get_sports", "sports");
    return response;
  });
};
