import type { FastifyPluginAsync } from "fastify";
import { getAreasCatalog, writeAuditLog } from "@sports-insights/evidence";

export const areasRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/areas", {
    schema: {
      description: "Get areas, competitions, seasons, and rounds catalog (optional sport filter)",
      tags: ["Catalog"],
      querystring: {
        type: "object",
        properties: {
          sport: { type: "string", enum: ["football", "basketball"] },
        },
      },
    },
  }, async (request) => {
    const sport = typeof request.query === "object" && request.query && "sport" in request.query
      ? String((request.query as { sport?: string }).sport ?? "")
      : undefined;

    const catalog = await getAreasCatalog(
      fastify.db,
      fastify.cache,
      sport || undefined,
    );
    await writeAuditLog(fastify.db, "get_areas", "areas");
    return catalog;
  });
};
