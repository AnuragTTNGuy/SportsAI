import fp from "fastify-plugin";
import { createCacheClient, type CacheClient } from "@sports-insights/cache";

declare module "fastify" {
  interface FastifyInstance {
    cache: CacheClient;
  }
}

export const cachePlugin = fp(async (fastify) => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required");
  }

  const cache = createCacheClient(redisUrl);
  fastify.decorate("cache", cache);

  fastify.addHook("onClose", async () => {
    await cache.disconnect();
  });
});
