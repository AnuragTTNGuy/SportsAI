import type { FastifyRequest } from "fastify";

export function resolveApiKeyFromRequest(request: FastifyRequest): string | undefined {
  const headerKey = request.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey.trim()) {
    return headerKey.trim();
  }

  const query = request.query as { apiKey?: string };
  if (typeof query.apiKey === "string" && query.apiKey.trim()) {
    return query.apiKey.trim();
  }

  return undefined;
}

export function isEmbedPath(url: string): boolean {
  return url.startsWith("/embed/");
}
