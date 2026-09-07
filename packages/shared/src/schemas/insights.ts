import { z } from "zod";

export const insightCardTypeSchema = z.enum([
  "form_guide",
  "h2h",
  "trend",
]);

export const insightCardSchema = z.object({
  type: insightCardTypeSchema,
  title: z.string(),
  evidenceIds: z.array(z.string()),
  payload: z.record(z.unknown()),
});

export const freshnessSchema = z.record(z.string(), z.string().datetime());

export const insightResponseSchema = z.object({
  eventId: z.string(),
  generatedAt: z.string().datetime(),
  freshness: freshnessSchema,
  cards: z.array(insightCardSchema),
  stats: z.record(z.unknown()),
  ladder: z.record(z.unknown()),
  lineup: z.record(z.unknown()),
});

export const evidenceRecordSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  type: z.string(),
  payload: z.record(z.unknown()),
  sourceStatIds: z.array(z.string()),
  computedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const eventSummarySchema = z.object({
  id: z.string(),
  competitionId: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  scheduledAt: z.string().datetime(),
  status: z.string(),
  sport: z.string(),
});

export const eventsListResponseSchema = z.object({
  events: z.array(eventSummarySchema),
});

export type InsightCardType = z.infer<typeof insightCardTypeSchema>;
export type InsightCard = z.infer<typeof insightCardSchema>;
export type InsightResponse = z.infer<typeof insightResponseSchema>;
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type EventSummary = z.infer<typeof eventSummarySchema>;

export const CACHE_KEYS = {
  insights: (eventId: string) => `insights:event:${eventId}:v1`,
  ladder: (competitionId: string) => `ladder:competition:${competitionId}:v1`,
  providerSchedules: (date: string) => `provider:schedules:${date}`,
} as const;

export const CACHE_TTL = {
  insights: 900,
  ladder: 3600,
  providerSchedules: 600,
} as const;
