import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    apiKeys: Set<string>;
  }
}

function parseApiKeys(): Set<string> {
  const raw = process.env.API_KEYS ?? "dev-key-1";
  return new Set(raw.split(",").map((key) => key.trim()).filter(Boolean));
}

export const authPlugin = fp(async (fastify) => {
  const apiKeys = parseApiKeys();
  fastify.decorate("apiKeys", apiKeys);

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === "/health" || request.url.startsWith("/docs")) {
      return;
    }

    const apiKey = request.headers["x-api-key"];
    if (typeof apiKey !== "string" || !apiKeys.has(apiKey)) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Valid X-API-Key header is required",
      });
    }
  });
});
