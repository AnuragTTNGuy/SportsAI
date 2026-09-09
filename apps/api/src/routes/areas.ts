import type { FastifyPluginAsync } from "fastify";
import { getAreasCatalog, writeAuditLog } from "@sports-insights/evidence";

export const areasRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/areas", {
    schema: {
      description: "Get football areas, competitions, seasons, and rounds catalog",
      tags: ["Catalog"],
    },
  }, async () => {
    const catalog = await getAreasCatalog(fastify.db, fastify.cache);
    await writeAuditLog(fastify.db, "get_areas", "areas");
    return catalog;
  });
};
