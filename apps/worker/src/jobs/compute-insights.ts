import { desc, eq, gte, and, sql } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { events } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import { computeFootballInsightsForEvent } from "@sports-insights/evidence";

export async function runComputeInsightsJob(
  db: Database,
  cache: CacheClient,
  data: { eventId?: string; limit?: number },
) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const targetEvents = data.eventId
    ? await db.query.events.findMany({ where: eq(events.id, data.eventId) })
    : await db.query.events.findMany({
      where: and(
        eq(events.sport, "football"),
        gte(events.scheduledAt, startOfToday),
        sql`lower(${events.status}) not in ('final', 'f/ot', 'completed', 'closed')`,
      ),
      orderBy: [desc(events.scheduledAt)],
      limit: data.limit ?? 25,
    });

  let computed = 0;
  let failed = 0;

  for (const event of targetEvents) {
    if (event.sport === "basketball") continue;
    try {
      const ok = await computeFootballInsightsForEvent(db, cache, event.id);
      if (ok) computed++;
      else failed++;
    } catch (error) {
      failed++;
      console.error(`Football insight compute failed for ${event.id}:`, error);
    }
  }

  console.log(`Football insights job done: ${computed} computed, ${failed} failed/empty`);
}
