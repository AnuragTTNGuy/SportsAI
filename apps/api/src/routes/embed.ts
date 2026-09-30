import type { FastifyPluginAsync } from "fastify";
import { insightCardTypeSchema } from "@sports-insights/shared";
import { getInsightResponse } from "@sports-insights/evidence";
import {
  renderEmbedErrorHtml,
  renderInsightBoardHtml,
  renderInsightCardWidget,
} from "../embed/render-card.js";
import { renderWidgetBuilderPage } from "../embed/widget-builder-page.js";

function getPublicApiUrl(request: { protocol: string; hostname: string }): string {
  const envUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const port = process.env.PORT ?? "5000";
  const host = request.hostname === "0.0.0.0" ? "127.0.0.1" : request.hostname;
  return `${request.protocol}://${host}:${port}`;
}

function setEmbedHeaders(reply: { header: (name: string, value: string) => void }) {
  reply.header("Content-Type", "text/html; charset=utf-8");
  reply.header("Content-Security-Policy", "frame-ancestors *");
}

export const embedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/embed/docs/widget-builder", {
    schema: {
      description: "Browser UI to load iframe snippets and copy embed HTML (linked from Swagger)",
      tags: ["Embed"],
    },
  }, async (request, reply) => {
    reply.type("text/html; charset=utf-8");
    return reply.send(renderWidgetBuilderPage(getPublicApiUrl(request)));
  });

  fastify.get("/embed/v1/events/:eventId/widgets/:cardType", {
    schema: {
      description:
        "Embeddable HTML widget for a single insight card (iframe `src`). "
        + "For copy-paste HTML use `GET /v1/embed/events/{eventId}/widgets/{cardType}/iframe-snippet` or "
        + "[widget builder](/embed/docs/widget-builder).",
      tags: ["Embed"],
      produces: ["text/html"],
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
          apiKey: { type: "string", description: "API key (required in iframe src when X-API-Key header is not available)" },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId, cardType } = request.params as { eventId: string; cardType: string };
    const parsedType = insightCardTypeSchema.safeParse(cardType);
    if (!parsedType.success) {
      setEmbedHeaders(reply);
      return reply.code(400).send(renderEmbedErrorHtml(`Unknown widget type: ${cardType}`));
    }

    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);
    if (!insights) {
      setEmbedHeaders(reply);
      return reply.code(404).send(renderEmbedErrorHtml("Event or insights not found"));
    }

    const card = insights.cards.find((c) => c.type === parsedType.data);
    if (!card) {
      setEmbedHeaders(reply);
      return reply.code(404).send(renderEmbedErrorHtml(`No ${cardType} insight for this event yet`));
    }

    setEmbedHeaders(reply);
    return reply.send(renderInsightCardWidget(card));
  });

  fastify.get("/embed/v1/events/:eventId/board", {
    schema: {
      description:
        "Embeddable HTML board with all insight cards. "
        + "Copy-paste snippets: `GET /v1/embed/events/{eventId}/iframe-snippets`.",
      tags: ["Embed"],
      produces: ["text/html"],
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
          apiKey: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const insights = await getInsightResponse(fastify.db, fastify.cache, eventId);
    if (!insights) {
      setEmbedHeaders(reply);
      return reply.code(404).send(renderEmbedErrorHtml("Event or insights not found"));
    }

    const stats = insights.stats as {
      homeTeam?: { team?: { name?: string } };
      awayTeam?: { team?: { name?: string } };
    };
    const title = `${stats.homeTeam?.team?.name ?? "Home"} vs ${stats.awayTeam?.team?.name ?? "Away"}`;

    setEmbedHeaders(reply);
    return reply.send(renderInsightBoardHtml(title, insights.cards));
  });
};
