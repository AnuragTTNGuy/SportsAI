import { Redis } from "ioredis";
import type { InsightResponse } from "@sports-insights/shared";

export type CacheClient = ReturnType<typeof createCacheClient>;

export function createCacheClient(redisUrl: string) {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  return {
    redis,

    async getJson<T>(key: string): Promise<T | null> {
      const value = await redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    },

    async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    },

    async getInsightPayload(eventId: string): Promise<InsightResponse | null> {
      const { CACHE_KEYS } = await import("@sports-insights/shared");
      return this.getJson<InsightResponse>(CACHE_KEYS.insights(eventId));
    },

    async setInsightPayload(eventId: string, payload: InsightResponse, ttlSeconds: number): Promise<void> {
      const { CACHE_KEYS } = await import("@sports-insights/shared");
      await this.setJson(CACHE_KEYS.insights(eventId), payload, ttlSeconds);
    },

    async getLadder(competitionId: string): Promise<Record<string, unknown> | null> {
      const { CACHE_KEYS } = await import("@sports-insights/shared");
      return this.getJson<Record<string, unknown>>(CACHE_KEYS.ladder(competitionId));
    },

    async setLadder(competitionId: string, payload: Record<string, unknown>, ttlSeconds: number): Promise<void> {
      const { CACHE_KEYS } = await import("@sports-insights/shared");
      await this.setJson(CACHE_KEYS.ladder(competitionId), payload, ttlSeconds);
    },

    async getAreasCatalog(): Promise<import("@sports-insights/shared").AreasCatalogResponse | null> {
      const { CACHE_KEYS } = await import("@sports-insights/shared");
      return this.getJson<import("@sports-insights/shared").AreasCatalogResponse>(CACHE_KEYS.areasCatalog());
    },

    async setAreasCatalog(
      payload: import("@sports-insights/shared").AreasCatalogResponse,
      ttlSeconds: number,
    ): Promise<void> {
      const { CACHE_KEYS } = await import("@sports-insights/shared");
      await this.setJson(CACHE_KEYS.areasCatalog(), payload, ttlSeconds);
    },

    async disconnect(): Promise<void> {
      await redis.quit();
    },
  };
}
