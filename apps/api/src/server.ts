import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi, { type FastifySwaggerUiConfigOptions } from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import { dbPlugin } from "./plugins/db.js";
import { cachePlugin } from "./plugins/cache.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { eventsRoutes } from "./routes/events.js";
import { competitionsRoutes } from "./routes/competitions.js";
import { areasRoutes } from "./routes/areas.js";
import { sportsRoutes } from "./routes/sports.js";
import { embedRoutes } from "./routes/embed.js";
import { embedSnippetRoutes } from "./routes/embed-snippets.js";
import { buildSwaggerUiConfig } from "./swagger/ui-config.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const swaggerThemeDir = dirname(fileURLToPath(import.meta.url));
const swaggerUiThemeCss = readFileSync(
  join(swaggerThemeDir, "swagger", "swagger-ui-theme.css"),
  "utf8",
);

const port = Number(process.env.PORT ?? 5000);
const publicApiUrl = (process.env.PUBLIC_API_URL ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Sports Insights API",
        description: [
          "Evidence-backed sports insights for football and basketball.",
          "",
          "### Embeddable iframe widgets",
          "- HTML widgets: `/embed/v1/events/{eventId}/widgets/{cardType}?apiKey=YOUR_KEY`",
          "- **Copy iframe code (JSON):** `GET /v1/embed/events/{eventId}/iframe-snippets` — use the `iframeHtml` field in the response.",
          "- **Widget builder (copy UI):** [Open iframe widget builder](/embed/docs/widget-builder)",
        ].join("\n"),
        version: "1.0.0",
      },
      tags: [
        {
          name: "Embed",
          description:
            "Iframe widgets for third-party sites. Use iframe-snippet endpoints to copy HTML, or the widget builder page.",
        },
      ],
      servers: [
        {
          url: publicApiUrl,
          description: "Local API server",
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            name: "X-API-Key",
            in: "header",
          },
        },
      },
      security: [{ apiKey: [] }],
    },
    transform: ({ schema, url }) => {
      if (url === "/health" || url.startsWith("/embed/")) {
        return { schema, url };
      }

      return {
        schema: {
          ...schema,
          security: [{ apiKey: [] }],
        },
        url,
      };
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: buildSwaggerUiConfig() as FastifySwaggerUiConfigOptions,
    theme: {
      css: [{ filename: "swagger-ui-theme.css", content: swaggerUiThemeCss }],
    },
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Key"],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(dbPlugin);
  await app.register(cachePlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(embedRoutes);
  await app.register(eventsRoutes, { prefix: "/v1" });
  await app.register(embedSnippetRoutes, { prefix: "/v1" });
  await app.register(competitionsRoutes, { prefix: "/v1" });
  await app.register(areasRoutes, { prefix: "/v1" });
  await app.register(sportsRoutes, { prefix: "/v1" });

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
