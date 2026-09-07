import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import { dbPlugin } from "./plugins/db.js";
import { cachePlugin } from "./plugins/cache.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { eventsRoutes } from "./routes/events.js";
import { competitionsRoutes } from "./routes/competitions.js";

const port = Number(process.env.PORT ?? 3000);

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
        description: "Evidence-backed sports insights for football events",
        version: "1.0.0",
      },
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
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(dbPlugin);
  await app.register(cachePlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(eventsRoutes, { prefix: "/v1" });
  await app.register(competitionsRoutes, { prefix: "/v1" });

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
