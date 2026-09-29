import type { FastifyPluginAsync } from "fastify";
import {
  getInsightResponse,
  listEventsByDate,
  listEventsByCompetition,
  writeAuditLog,
} from "@sports-insights/evidence";

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/events", {
    schema: {
      description: "List football events for a date",
      tags: ["Events"],
      querystring: {
        type: "object",
        required: ["date"],
        properties: {
          date: { type: "string", format: "date" },
          sport: { type: "string", default: "football" },
        },
      },
    },
  }, async (request) => {
    const { date, sport = "football" } = request.query as { date: string; sport?: string };
    const eventList = await listEventsByDate(fastify.db, new Date(date), sport);

    await writeAuditLog(fastify.db, "list_events", "events", undefined, { date, sport });

    return { events: eventList };
  });

  fastify.get("/events/by-competition", {
    schema: {
      description: "List events filtered by competition name and sport",
      tags: ["Events"],
      querystring: {
        type: "object",
        required: ["competition", "sport"],
        properties: {
          competition: { type: "string", description: "Competition name (partial match, case-insensitive)" },
          sport: { type: "string", default: "football" },
          date: { type: "string", format: "date", description: "Optional date filter (YYYY-MM-DD)" },
          upcoming: {
            type: "boolean",
            description: "When true, only future/non-final games. Defaults to true for all sports.",
          },
        },
      },
    },
  }, async (request) => {
    const { competition, sport, date, upcoming } = request.query as {
      competition: string;
      sport: string;
      date?: string;
      upcoming?: boolean | string;
    };

    const upcomingOnly = upcoming === undefined
      ? undefined
      : upcoming === true || upcoming === "true";

    const eventList = await listEventsByCompetition(
      fastify.db,
      competition,
      sport,
      date ? new Date(date) : undefined,
      { upcomingOnly },
    );

    await writeAuditLog(fastify.db, "list_events_by_competition", "events", undefined, {
      competition,
      sport,
      date,
      upcomingOnly: upcomingOnly ?? true,
      count: eventList.length,
    });

    return { events: eventList };
  });

  fastify.get("/events/:eventId/insights", {
    schema: {
      description: "Get full insight payload for an event",
      tags: ["Insights"],
      params: {
        type: "object",
        required: ["eventId"],
        properties: {
          eventId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);

    if (!insights) {
      return reply.code(404).send({ error: "Not Found", message: "Event or insights not found" });
    }

    await writeAuditLog(fastify.db, "get_insights", "events", eventId);
    return insights;
  });

  fastify.get("/events/:eventId/insights/cards", {
    schema: {
      description: "Get insight cards only",
      tags: ["Insights"],
      params: {
        type: "object",
        required: ["eventId"],
        properties: {
          eventId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);

    if (!insights) {
      return reply.code(404).send({ error: "Not Found", message: "Event or insights not found" });
    }

    await writeAuditLog(fastify.db, "get_insight_cards", "events", eventId);
    return { eventId: insights.eventId, cards: insights.cards, freshness: insights.freshness };
  });

  fastify.get("/events/:eventId/stats", {
    schema: {
      description: "Get team and player stats block",
      tags: ["Insights"],
      params: {
        type: "object",
        required: ["eventId"],
        properties: {
          eventId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);

    if (!insights) {
      return reply.code(404).send({ error: "Not Found", message: "Event or insights not found" });
    }

    await writeAuditLog(fastify.db, "get_stats", "events", eventId);
    return { eventId: insights.eventId, stats: insights.stats };
  });

  fastify.get("/events/:eventId/lineup", {
    schema: {
      description: "Get confirmed line-ups for an event",
      tags: ["Insights"],
      params: {
        type: "object",
        required: ["eventId"],
        properties: {
          eventId: { type: "string", format: "uuid" },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);

    if (!insights) {
      return reply.code(404).send({ error: "Not Found", message: "Event or insights not found" });
    }

    await writeAuditLog(fastify.db, "get_lineup", "events", eventId);
    return { eventId: insights.eventId, lineup: insights.lineup };
  });
};
