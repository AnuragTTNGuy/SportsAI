import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "@sports-insights/db";
import { areas, competitions, events, evidenceRecords, statSnapshots } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import type { CanonicalEvent } from "@sports-insights/normalise";
import {
  createNbaComProvider,
  findNbaTeamById,
  NBA_TEAMS,
  nbaTeamFullName,
} from "@sports-insights/provider";
import {
  upsertCompetition,
  upsertEvent,
  upsertTeam,
  writeAuditLog,
} from "@sports-insights/evidence";

const NBA_COMPETITION_PROVIDER = "nba.com";
const NBA_COMPETITION_ID = "nba";

/** Sample tip-off style matchups used when the live scoreboard has no upcoming games (offseason). */
const FALLBACK_MATCHUPS: Array<[number, number]> = [
  [1610612747, 1610612738], // LAL vs BOS
  [1610612744, 1610612743], // GSW vs DEN
  [1610612752, 1610612755], // NYK vs PHI
  [1610612748, 1610612749], // MIA vs MIL
  [1610612760, 1610612742], // OKC vs DAL
  [1610612756, 1610612746], // PHX vs LAC
  [1610612751, 1610612761], // BKN vs TOR
  [1610612741, 1610612739], // CHI vs CLE
  [1610612750, 1610612757], // MIN vs POR
  [1610612740, 1610612759], // NOP vs SAS
];

export async function ensureNbaCatalog(db: Database) {
  const [area] = await db
    .insert(areas)
    .values({
      name: "North America",
      countryCode: "US",
      sport: "basketball",
      provider: NBA_COMPETITION_PROVIDER,
      providerId: "nba-area",
    })
    .onConflictDoUpdate({
      target: [areas.provider, areas.providerId],
      set: {
        name: "North America",
        countryCode: "US",
        sport: "basketball",
        capturedAt: new Date(),
      },
    })
    .returning();

  const competition = await upsertCompetition(db, {
    provider: NBA_COMPETITION_PROVIDER,
    providerId: NBA_COMPETITION_ID,
    areaProviderId: "nba-area",
    name: "NBA",
    sport: "basketball",
    key: "NBA",
    competitionType: "League",
    format: "Regular Season",
  });

  await db
    .update(competitions)
    .set({ areaId: area!.id, sport: "basketball", updatedAt: new Date() })
    .where(eq(competitions.id, competition.id));

  for (const team of NBA_TEAMS) {
    await upsertTeam(db, {
      provider: NBA_COMPETITION_PROVIDER,
      providerId: String(team.teamId),
      name: nbaTeamFullName(team),
      shortName: team.key,
      sport: "basketball",
    });
  }

  return competition;
}

function toCanonicalUpcoming(
  homeId: number,
  awayId: number,
  scheduledAt: Date,
  index: number,
): CanonicalEvent {
  const home = findNbaTeamById(homeId)!;
  const away = findNbaTeamById(awayId)!;
  return {
    provider: NBA_COMPETITION_PROVIDER,
    providerId: `upcoming-${scheduledAt.toISOString().slice(0, 10)}-${index}`,
    competitionProviderId: NBA_COMPETITION_ID,
    homeTeam: {
      provider: NBA_COMPETITION_PROVIDER,
      providerId: String(home.teamId),
      name: nbaTeamFullName(home),
      shortName: home.key,
      sport: "basketball",
    },
    awayTeam: {
      provider: NBA_COMPETITION_PROVIDER,
      providerId: String(away.teamId),
      name: nbaTeamFullName(away),
      shortName: away.key,
      sport: "basketball",
    },
    scheduledAt,
    status: "Scheduled",
    sport: "basketball",
  };
}

function buildFallbackUpcomingSlate(count = 12): CanonicalEvent[] {
  const eventsList: CanonicalEvent[] = [];
  const start = new Date();
  start.setHours(19, 30, 0, 0);
  // Prefer next tip-off window in October if we are in the offseason (Jul–Sep)
  const month = start.getMonth();
  if (month >= 6 && month <= 8) {
    start.setMonth(9, 21);
    start.setHours(19, 30, 0, 0);
  } else {
    start.setDate(start.getDate() + 1);
  }

  for (let i = 0; i < count; i++) {
    const tip = new Date(start);
    tip.setDate(start.getDate() + i);
    // Skip hypothetical "off nights" every 3rd slot for a more schedule-like feel
    if (i % 3 === 2) continue;
    const [homeId, awayId] = FALLBACK_MATCHUPS[i % FALLBACK_MATCHUPS.length]!;
    eventsList.push(toCanonicalUpcoming(homeId, awayId, tip, i));
  }
  return eventsList;
}

/** Date windows to scan for upcoming NBA games. */
export function getNbaUpcomingWindows(upcomingDays = 14): Array<{ start: Date; end: Date; label: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nearEnd = new Date(today);
  nearEnd.setDate(nearEnd.getDate() + upcomingDays);
  const windows = [{ start: today, end: nearEnd, label: `next ${upcomingDays} days` }];

  // Offseason: also peek at typical tip-off week in October
  const month = today.getMonth();
  if (month >= 6 && month <= 8) {
    const tipStart = new Date(Date.UTC(today.getFullYear(), 9, 20));
    const tipEnd = new Date(Date.UTC(today.getFullYear(), 9, 27));
    windows.push({ start: tipStart, end: tipEnd, label: "late-Oct tip-off peek" });
  }

  return windows;
}

async function deleteEventsByIds(db: Database, ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(evidenceRecords).where(inArray(evidenceRecords.eventId, ids));
  await db.delete(statSnapshots).where(inArray(statSnapshots.eventId, ids));
  await db.delete(events).where(inArray(events.id, ids));
}

async function pruneCompletedBasketballEvents(db: Database) {
  const completed = await db
    .select({ id: events.id })
    .from(events)
    .where(and(
      eq(events.sport, "basketball"),
      sql`lower(${events.status}) in ('final', 'f/ot', 'completed', 'closed')`,
    ));

  const ids = completed.map((row) => row.id);
  await deleteEventsByIds(db, ids);
  return ids.length;
}

function isNbaOffseason(date = new Date()) {
  const month = date.getMonth();
  // Roughly July–September (and early October before tip-off)
  return month >= 6 && month <= 8;
}

export async function runIngestNbaSchedulesJob(
  db: Database,
  _cache: CacheClient,
  data: {
    /** Days ahead from today to scan on the scoreboard */
    includeUpcomingDays?: number;
    /** When true, also keep/ingest completed season games (not used for the matches UI) */
    includeCompletedSeason?: boolean;
    /** Remove completed basketball events from the DB (default true) */
    pruneCompleted?: boolean;
    /** Seed a demo upcoming slate if the scoreboard returns nothing */
    allowFallbackSlate?: boolean;
    /** Skip live scoreboard and seed the demo slate immediately */
    fallbackOnly?: boolean;
  } = {},
) {
  const provider = createNbaComProvider({
    statsBaseUrl: process.env.NBA_STATS_BASE_URL,
    timeoutMs: process.env.NBA_STATS_TIMEOUT_MS
      ? Number(process.env.NBA_STATS_TIMEOUT_MS)
      : 8_000,
  });

  const competition = await ensureNbaCatalog(db);
  const upcomingDays = data.includeUpcomingDays ?? 14;
  const pruneCompleted = data.pruneCompleted ?? true;
  const allowFallbackSlate = data.allowFallbackSlate ?? true;
  const fallbackOnly = data.fallbackOnly ?? isNbaOffseason();

  if (pruneCompleted) {
    const removed = await pruneCompletedBasketballEvents(db);
    if (removed > 0) {
      console.log(`Pruned ${removed} completed basketball events (insights use live historical APIs)`);
    }
  }

  // Also drop past scheduled leftovers
  const past = await db
    .select({ id: events.id })
    .from(events)
    .where(and(
      eq(events.sport, "basketball"),
      lt(events.scheduledAt, new Date(new Date().setHours(0, 0, 0, 0))),
    ));
  await deleteEventsByIds(db, past.map((row) => row.id));

  const upcoming: CanonicalEvent[] = [];

  if (!fallbackOnly) {
    const liveTimeoutMs = Number(process.env.NBA_UPCOMING_LIVE_TIMEOUT_MS ?? 15_000);
    const liveDeadline = Date.now() + liveTimeoutMs;

    for (const window of getNbaUpcomingWindows(upcomingDays)) {
      if (Date.now() > liveDeadline) {
        console.warn("Upcoming scoreboard scan timed out — using what we have / fallback");
        break;
      }
      console.log(`Fetching NBA upcoming scoreboard (${window.label})...`);
      try {
        const cappedEnd = new Date(window.start);
        cappedEnd.setUTCDate(cappedEnd.getUTCDate() + Math.min(5, upcomingDays));
        const end = cappedEnd < window.end ? cappedEnd : window.end;
        const rangeGames = await provider.getGamesByDateRange(window.start, end, NBA_COMPETITION_ID);
        const open = rangeGames.filter((game) => game.status !== "Final");
        console.log(`  → ${open.length} non-final games`);
        upcoming.push(...open);
        if (open.length > 0) break;
      } catch (error) {
        console.warn(`  → skipped: ${(error as Error).message}`);
      }
    }
  } else {
    console.log("Offseason mode — skipping live scoreboard scan");
  }

  let source: "scoreboard" | "fallback" = "scoreboard";
  let schedules = upcoming;

  if (schedules.length === 0 && allowFallbackSlate) {
    schedules = buildFallbackUpcomingSlate(12);
    source = "fallback";
    console.log(`Seeded ${schedules.length} upcoming fixtures (demo slate)`);
    console.log("(Insights still use real historical NBA.com team/player data)");
  }

  const byId = new Map<string, CanonicalEvent>();
  for (const game of schedules) {
    byId.set(game.providerId, game);
  }

  let ingested = 0;
  for (const schedule of byId.values()) {
    const competitionRow = await db.query.competitions.findFirst({
      where: and(
        eq(competitions.provider, NBA_COMPETITION_PROVIDER),
        eq(competitions.providerId, NBA_COMPETITION_ID),
      ),
    });
    if (!competitionRow) continue;

    const homeTeam = await upsertTeam(db, schedule.homeTeam);
    const awayTeam = await upsertTeam(db, schedule.awayTeam);
    await upsertEvent(db, schedule, competitionRow.id, homeTeam.id, awayTeam.id);
    ingested++;
  }

  await writeAuditLog(db, "ingest_nba_schedules", "events", undefined, {
    ingested,
    upcoming: schedules.length,
    source,
    competitionId: competition.id,
  });

  console.log(
    `Ingested ${ingested} upcoming NBA games into ${competition.name} (${competition.id}) [source=${source}]`,
  );
  return { ingested, competitionId: competition.id, source };
}
