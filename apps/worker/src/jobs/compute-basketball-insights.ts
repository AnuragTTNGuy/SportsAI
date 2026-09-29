import { desc, eq } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { events } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import { computeBasketballInsightsForEvent } from "@sports-insights/evidence";

export async function runComputeBasketballInsightsJob(
  db: Database,
  cache: CacheClient,
  data: { eventId?: string; limit?: number },
) {
  const targetEvents = data.eventId
    ? await db.query.events.findMany({ where: eq(events.id, data.eventId) })
    : await db.query.events.findMany({
      where: eq(events.sport, "basketball"),
      orderBy: [desc(events.scheduledAt)],
      limit: data.limit ?? 25,
    });

  let computed = 0;
  let failed = 0;

  for (const event of targetEvents) {
    try {
      const ok = await computeBasketballInsightsForEvent(db, cache, event.id);
      if (ok) computed++;
      else failed++;
    } catch (error) {
      failed++;
      console.error(`Basketball insight compute failed for ${event.id}:`, error);
    }
  }

  console.log(`Basketball insights job done: ${computed} computed, ${failed} failed/empty`);
}
