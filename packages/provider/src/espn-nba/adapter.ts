/**
 * ESPN site API basketball provider — fallback when stats.nba.com is blocked/unreachable.
 * Public endpoints under site.api.espn.com (no API key).
 */
import type {
  BasketballMatchResult,
  BasketballTeamStats,
  NbaGame,
  NbaStanding,
  NbaTeamProfile,
} from "@sports-insights/normalise";
import type { CanonicalEvent, CanonicalTeam } from "@sports-insights/normalise";
import {
  findNbaTeamByEspnId,
  findNbaTeamById,
  findNbaTeamByKey,
  NBA_TEAMS,
  nbaTeamFullName,
} from "../nba-com/teams.js";
import type { NbaComPlayerGameStat } from "../nba-com/adapter.js";
import { getNbaSeasonStartYear } from "../nba-com/adapter.js";

const PROVIDER = "espn";
const DEFAULT_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";

export interface EspnNbaProviderConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

interface EspnCompetitor {
  homeAway?: string;
  winner?: boolean;
  score?: number | string | { value?: number; displayValue?: string };
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
}

interface EspnCompetition {
  status?: { type?: { completed?: boolean; name?: string; state?: string } };
  competitors?: EspnCompetitor[];
  venue?: { fullName?: string; address?: { city?: string } };
  broadcasts?: Array<{ names?: string[] }>;
}

interface EspnEvent {
  id?: string;
  date?: string;
  name?: string;
  competitions?: EspnCompetition[];
}

function toTeam(teamId: number, key: string, name: string): CanonicalTeam {
  return {
    provider: "nba.com",
    providerId: String(teamId),
    name,
    shortName: key,
    sport: "basketball",
  };
}

function parseScore(score: EspnCompetitor["score"]): number {
  if (score == null) return 0;
  if (typeof score === "number") return score;
  if (typeof score === "string") return Number(score) || 0;
  if (typeof score === "object") {
    if (score.value != null) return Number(score.value) || 0;
    if (score.displayValue != null) return Number(score.displayValue) || 0;
  }
  return 0;
}

/** ESPN season year = ending calendar year of the NBA season (2025-26 → 2026). */
export function getEspnSeasonYear(date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  // Oct–Dec: new season (ending next calendar year)
  if (month >= 9) return year + 1;
  // Jan–Sep: season ending this calendar year (or just finished)
  return year;
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ESPN request failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function resolveEspnId(nbaTeamProviderId: string): number {
  const meta = findNbaTeamById(nbaTeamProviderId);
  if (!meta) {
    throw new Error(`Unknown NBA team provider id: ${nbaTeamProviderId}`);
  }
  return meta.espnId;
}

function eventToCanonical(
  event: EspnEvent,
  competitionProviderId: string,
): CanonicalEvent | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team || !away?.team) return null;

  const homeMeta = findNbaTeamByEspnId(home.team.id ?? "")
    ?? findNbaTeamByKey(home.team.abbreviation ?? "");
  const awayMeta = findNbaTeamByEspnId(away.team.id ?? "")
    ?? findNbaTeamByKey(away.team.abbreviation ?? "");

  const homeTeamId = homeMeta?.teamId ?? (Number(home.team.id) || 0);
  const awayTeamId = awayMeta?.teamId ?? (Number(away.team.id) || 0);
  const homeKey = homeMeta?.key ?? home.team.abbreviation ?? "HOME";
  const awayKey = awayMeta?.key ?? away.team.abbreviation ?? "AWAY";
  const homeName = homeMeta ? nbaTeamFullName(homeMeta) : (home.team.displayName ?? "Home");
  const awayName = awayMeta ? nbaTeamFullName(awayMeta) : (away.team.displayName ?? "Away");

  const completed = Boolean(competition?.status?.type?.completed);
  const statusName = competition?.status?.type?.name ?? "";
  let status = "Scheduled";
  if (completed || /final/i.test(statusName)) status = "Final";
  else if (/progress|in/i.test(statusName) || competition?.status?.type?.state === "in") {
    status = "InProgress";
  }

  return {
    provider: PROVIDER,
    providerId: String(event.id ?? ""),
    competitionProviderId,
    homeTeam: toTeam(homeTeamId, homeKey, homeName),
    awayTeam: toTeam(awayTeamId, awayKey, awayName),
    scheduledAt: event.date ? new Date(event.date) : new Date(),
    status,
    sport: "basketball",
    homeScore: completed ? parseScore(home.score) : undefined,
    awayScore: completed ? parseScore(away.score) : undefined,
  };
}

function eventToNbaGame(event: EspnEvent): NbaGame | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team || !away?.team) return null;

  const homeMeta = findNbaTeamByEspnId(home.team.id ?? "")
    ?? findNbaTeamByKey(home.team.abbreviation ?? "");
  const awayMeta = findNbaTeamByEspnId(away.team.id ?? "")
    ?? findNbaTeamByKey(away.team.abbreviation ?? "");
  const completed = Boolean(competition?.status?.type?.completed);
  const channel = competition?.broadcasts?.[0]?.names?.[0];

  return {
    gameId: Number(event.id) || 0,
    seasonYear: getNbaSeasonStartYear(event.date ? new Date(event.date) : new Date()),
    seasonType: "REG",
    gameDate: (event.date ?? "").slice(0, 10),
    gameDatetime: event.date,
    homeTeamId: homeMeta?.teamId ?? (Number(home.team.id) || 0),
    awayTeamId: awayMeta?.teamId ?? (Number(away.team.id) || 0),
    homeTeamKey: homeMeta?.key ?? home.team.abbreviation ?? "",
    awayTeamKey: awayMeta?.key ?? away.team.abbreviation ?? "",
    homeTeamName: homeMeta ? nbaTeamFullName(homeMeta) : (home.team.displayName ?? "Home"),
    awayTeamName: awayMeta ? nbaTeamFullName(awayMeta) : (away.team.displayName ?? "Away"),
    venueName: competition?.venue?.fullName,
    homeScore: completed ? parseScore(home.score) : undefined,
    awayScore: completed ? parseScore(away.score) : undefined,
    status: completed ? "Final" : "Scheduled",
    channel,
  };
}

export function createEspnNbaProvider(config: EspnNbaProviderConfig = {}) {
  const baseUrl = (config.baseUrl ?? process.env.ESPN_NBA_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const timeoutMs = config.timeoutMs ?? Number(process.env.ESPN_NBA_TIMEOUT_MS ?? 15_000);

  async function getTeamSchedule(espnTeamId: number, season: number): Promise<EspnEvent[]> {
    const payload = await fetchJson<{ events?: EspnEvent[] }>(
      `${baseUrl}/teams/${espnTeamId}/schedule?season=${season}`,
      timeoutMs,
    );
    return payload.events ?? [];
  }

  async function getCompletedResults(
    nbaTeamProviderId: string,
    lastN: number,
    season?: number,
  ): Promise<BasketballMatchResult[]> {
    const meta = findNbaTeamById(nbaTeamProviderId);
    if (!meta) return [];

    const seasonYear = season ?? getEspnSeasonYear();
    let events = await getTeamSchedule(meta.espnId, seasonYear);
    let completed = events.filter((e) => e.competitions?.[0]?.status?.type?.completed);

    // Early in a new season, fall back to the prior completed season.
    if (completed.length < lastN && season == null) {
      const prior = await getTeamSchedule(meta.espnId, seasonYear - 1);
      const priorCompleted = prior.filter((e) => e.competitions?.[0]?.status?.type?.completed);
      completed = [...priorCompleted, ...completed];
    }

    const results: BasketballMatchResult[] = [];
    for (const event of completed) {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors ?? [];
      const self = competitors.find((c) => Number(c.team?.id) === meta.espnId);
      const opp = competitors.find((c) => Number(c.team?.id) !== meta.espnId);
      if (!self || !opp) continue;

      const pointsFor = parseScore(self.score);
      const pointsAgainst = parseScore(opp.score);
      results.push({
        opponent: opp.team?.shortDisplayName ?? opp.team?.abbreviation ?? "Opponent",
        result: self.winner || pointsFor > pointsAgainst ? "W" : "L",
        pointsFor,
        pointsAgainst,
        date: (event.date ?? "").slice(0, 10),
        homeOrAway: self.homeAway === "home" ? "HOME" : "AWAY",
      });
    }

    return results
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, lastN);
  }

  return {
    name: PROVIDER,

    async getTeams(): Promise<NbaTeamProfile[]> {
      return NBA_TEAMS.map((team) => ({
        teamId: team.teamId,
        key: team.key,
        name: nbaTeamFullName(team),
        city: team.city,
        conference: team.conference,
        division: team.division,
      }));
    },

    async getVenues(): Promise<Array<{ venueId: number; name: string; city?: string; state?: string }>> {
      return [];
    },

    async getGamesByDate(date: Date): Promise<NbaGame[]> {
      const yyyymmdd = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("");
      const payload = await fetchJson<{ events?: EspnEvent[] }>(
        `${baseUrl}/scoreboard?dates=${yyyymmdd}`,
        timeoutMs,
      );
      return (payload.events ?? [])
        .map(eventToNbaGame)
        .filter((game): game is NbaGame => Boolean(game));
    },

    async getSchedules(
      _competitionProviderId: string,
      fromDate: Date,
      toDate?: Date,
    ): Promise<CanonicalEvent[]> {
      const end = toDate ?? fromDate;
      const events: CanonicalEvent[] = [];
      const cursor = new Date(fromDate);
      cursor.setHours(0, 0, 0, 0);
      const last = new Date(end);
      last.setHours(0, 0, 0, 0);

      while (cursor <= last) {
        const games = await this.getGamesByDate(cursor);
        for (const game of games) {
          events.push({
            provider: PROVIDER,
            providerId: String(game.gameId).padStart(10, "0"),
            competitionProviderId: "nba",
            homeTeam: toTeam(game.homeTeamId, game.homeTeamKey, game.homeTeamName),
            awayTeam: toTeam(game.awayTeamId, game.awayTeamKey, game.awayTeamName),
            scheduledAt: game.gameDatetime ? new Date(game.gameDatetime) : new Date(game.gameDate),
            status: game.status,
            sport: "basketball",
            homeScore: game.homeScore,
            awayScore: game.awayScore,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      return events.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    },

    async getHeadToHeadEvents(
      homeTeamProviderId: string,
      awayTeamProviderId: string,
      competitionProviderId = "nba",
      season?: string,
    ): Promise<CanonicalEvent[]> {
      const homeEspnId = resolveEspnId(homeTeamProviderId);
      const awayMeta = findNbaTeamById(awayTeamProviderId);
      if (!awayMeta) return [];

      const seasonYear = season
        ? Number(season.slice(0, 4)) + 1
        : getEspnSeasonYear();

      const seasons = [seasonYear, seasonYear - 1, seasonYear - 2];
      const meetings: CanonicalEvent[] = [];
      const seen = new Set<string>();

      for (const year of seasons) {
        const events = await getTeamSchedule(homeEspnId, year);
        for (const event of events) {
          if (!event.competitions?.[0]?.status?.type?.completed) continue;
          const competitors = event.competitions?.[0]?.competitors ?? [];
          const hasAway = competitors.some(
            (c) => Number(c.team?.id) === awayMeta.espnId
              || c.team?.abbreviation?.toUpperCase() === awayMeta.espnKey
              || c.team?.abbreviation?.toUpperCase() === awayMeta.key,
          );
          if (!hasAway) continue;
          const canonical = eventToCanonical(event, competitionProviderId);
          if (!canonical || seen.has(canonical.providerId)) continue;
          seen.add(canonical.providerId);
          meetings.push(canonical);
        }
      }

      return meetings.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
    },

    async getStandings(season?: number): Promise<NbaStanding[]> {
      const seasonStart = season ?? getNbaSeasonStartYear();
      // ESPN standings year = season end year
      const espnYear = seasonStart + 1;
      const payload = await fetchJson<{
        children?: Array<{
          standings?: {
            entries?: Array<{
              team?: { id?: string; abbreviation?: string; displayName?: string };
              stats?: Array<{ name?: string; value?: number }>;
            }>;
          };
        }>;
      }>(`${STANDINGS_URL}?season=${espnYear}`, timeoutMs);

      const rows: NbaStanding[] = [];
      for (const conference of payload.children ?? []) {
        for (const entry of conference.standings?.entries ?? []) {
          const meta = findNbaTeamByEspnId(entry.team?.id ?? "")
            ?? findNbaTeamByKey(entry.team?.abbreviation ?? "");
          const stats = new Map((entry.stats ?? []).map((s) => [s.name ?? "", s.value ?? 0]));
          const wins = Number(stats.get("wins") ?? 0);
          const losses = Number(stats.get("losses") ?? 0);
          rows.push({
            teamId: meta?.teamId ?? (Number(entry.team?.id) || 0),
            teamKey: meta?.key ?? entry.team?.abbreviation ?? "",
            teamName: meta ? nbaTeamFullName(meta) : (entry.team?.displayName ?? "Team"),
            wins,
            losses,
            winPct: Number(stats.get("winPercent") ?? (wins + losses ? wins / (wins + losses) : 0)),
            conferenceRank: stats.has("playoffSeed") ? Number(stats.get("playoffSeed")) : undefined,
            gamesBack: stats.has("gamesBehind") ? Number(stats.get("gamesBehind")) : undefined,
          });
        }
      }
      return rows;
    },

    async getTeamGameStats(teamProviderId: string, lastN: number, _season?: string): Promise<BasketballTeamStats> {
      const meta = findNbaTeamById(teamProviderId);
      const recentResults = await getCompletedResults(teamProviderId, lastN);
      const pointsScored = recentResults.reduce((sum, r) => sum + r.pointsFor, 0);
      const pointsConceded = recentResults.reduce((sum, r) => sum + r.pointsAgainst, 0);
      const count = recentResults.length || 1;
      const name = meta ? nbaTeamFullName(meta) : "Team";
      const key = meta?.key ?? teamProviderId;

      return {
        team: toTeam(Number(teamProviderId), key, name),
        recentResults,
        pointsScored,
        pointsConceded,
        avgPointsFor: Math.round((pointsScored / count) * 10) / 10,
        avgPointsAgainst: Math.round((pointsConceded / count) * 10) / 10,
      };
    },

    async getPlayerGameStatsByTeam(
      _teamProviderId: string,
      _season?: string,
    ): Promise<NbaComPlayerGameStat[]> {
      // ESPN site API does not expose recent player game logs without auth; skip spotlight.
      return [];
    },
  };
}

export type EspnNbaProvider = ReturnType<typeof createEspnNbaProvider>;
