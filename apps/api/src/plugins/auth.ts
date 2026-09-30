import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isEmbedPath, resolveApiKeyFromRequest } from "../embed/auth.js";

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
    const path = request.url.split("?")[0] ?? request.url;
    if (path === "/health" || path.startsWith("/docs") || path.startsWith("/embed/docs/")) {
      return;
    }

    const apiKey = isEmbedPath(path)
      ? resolveApiKeyFromRequest(request)
      : (typeof request.headers["x-api-key"] === "string" ? request.headers["x-api-key"] : undefined);

    if (typeof apiKey !== "string" || !apiKeys.has(apiKey)) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Valid X-API-Key header is required",
      });
    }
  });
});
