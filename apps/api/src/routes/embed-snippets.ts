import type { FastifyPluginAsync } from "fastify";
import { insightCardTypeSchema } from "@sports-insights/shared";
import { getInsightResponse } from "@sports-insights/evidence";
import { resolveApiKeyFromRequest } from "../embed/auth.js";
import {
  buildBoardSnippet,
  buildSnippetForCard,
} from "../embed/snippets.js";

function getPublicApiUrl(request: { protocol: string; hostname: string }): string {
  const envUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const port = process.env.PORT ?? "5000";
  const host = request.hostname === "0.0.0.0" ? "127.0.0.1" : request.hostname;
  return `${request.protocol}://${host}:${port}`;
}

function resolveApiKeyForSnippet(request: { headers: Record<string, unknown> }): string {
  const key = resolveApiKeyFromRequest(request as Parameters<typeof resolveApiKeyFromRequest>[0]);
  if (!key) {
    throw new Error("API key required (X-API-Key header or apiKey query param)");
  }
  return key;
}

const snippetResponseSchema = {
  type: "object",
  properties: {
    cardType: { type: "string" },
    title: { type: "string" },
    embedUrl: { type: "string", description: "URL to use as iframe src" },
    iframeHtml: { type: "string", description: "Ready-to-paste iframe HTML — copy this into any site" },
    recommendedHeight: { type: "number" },
    htmlWidgetPath: { type: "string" },
  },
};

export const embedSnippetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/embed/events/:eventId/iframe-snippets", {
    schema: {
      description:
        "Returns copy-paste iframe HTML for every insight card on this event (plus a full board). "
        + "Use **iframeHtml** in the response, or open `/embed/docs/widget-builder` in the browser.",
      tags: ["Embed"],
      params: {
        type: "object",
        required: ["eventId"],
        properties: {
          eventId: { type: "string", format: "uuid" },
        },
      },
      querystring: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            description: "Optional if X-API-Key header is set; used to build embed URLs",
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            eventId: { type: "string" },
            matchTitle: { type: "string" },
            snippets: { type: "array", items: snippetResponseSchema },
            board: snippetResponseSchema,
          },
        },
        401: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    let apiKey: string;
    try {
      apiKey = resolveApiKeyForSnippet(request);
    } catch {
      return reply.code(401).send({ error: "Unauthorized", message: "API key required" });
    }

    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);
    if (!insights) {
      return reply.code(404).send({ error: "Not Found", message: "Event or insights not found" });
    }

    const stats = insights.stats as {
      homeTeam?: { team?: { name?: string } };
      awayTeam?: { team?: { name?: string } };
    };
    const matchTitle = `${stats.homeTeam?.team?.name ?? "Home"} vs ${stats.awayTeam?.team?.name ?? "Away"}`;
    const publicApiUrl = getPublicApiUrl(request);

    const snippets = insights.cards.map((card) =>
      buildSnippetForCard(publicApiUrl, eventId, card, apiKey),
    );
    const board = buildBoardSnippet(publicApiUrl, eventId, matchTitle, apiKey);

    return { eventId, matchTitle, snippets, board };
  });

  fastify.get("/embed/events/:eventId/widgets/:cardType/iframe-snippet", {
    schema: {
      description:
        "Copy-paste iframe HTML for a single widget type. Response field **iframeHtml** is ready to embed.",
      tags: ["Embed"],
      params: {
        type: "object",
        required: ["eventId", "cardType"],
        properties: {
          eventId: { type: "string", format: "uuid" },
          cardType: { type: "string" },
        },
      },
      querystring: {
        type: "object",
        properties: {
          apiKey: { type: "string" },
        },
      },
      response: {
        200: snippetResponseSchema,
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        401: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId, cardType } = request.params as { eventId: string; cardType: string };
    const parsed = insightCardTypeSchema.safeParse(cardType);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Bad Request", message: `Unknown card type: ${cardType}` });
    }

    let apiKey: string;
    try {
      apiKey = resolveApiKeyForSnippet(request);
    } catch {
      return reply.code(401).send({ error: "Unauthorized", message: "API key required" });
    }

    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);
    if (!insights) {
      return reply.code(404).send({ error: "Not Found", message: "Event or insights not found" });
    }

    const card = insights.cards.find((c) => c.type === parsed.data);
    if (!card) {
      return reply.code(404).send({ error: "Not Found", message: `No ${cardType} insight for this event` });
    }

    const publicApiUrl = getPublicApiUrl(request);
    return buildSnippetForCard(publicApiUrl, eventId, card, apiKey);
  });
};
