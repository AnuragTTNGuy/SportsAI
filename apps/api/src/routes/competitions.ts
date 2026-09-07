import type { FastifyPluginAsync } from "fastify";
import { getLadderForCompetition, writeAuditLog } from "@sports-insights/evidence";

export const competitionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/competitions/:compId/ladder", {
    schema: {
      description: "Get competition standings ladder",
      tags: ["Competitions"],
      params: {
        type: "object",
        required: ["compId"],
        properties: {
          compId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request) => {
    const { compId } = request.params as { compId: string };
    const ladder = await getLadderForCompetition(fastify.db, fastify.cache, compId);

    await writeAuditLog(fastify.db, "get_ladder", "competitions", compId);
    return ladder;
  });
};
