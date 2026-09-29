/**
 * NBA.com stats provider (same endpoints wrapped by https://github.com/swar/nba_api).
 * Calls stats.nba.com / cdn.nba.com directly from Node — no Python dependency.
 */
import type {
  BasketballMatchResult,
  BasketballTeamStats,
  NbaGame,
  NbaStanding,
  NbaTeamProfile,
} from "@sports-insights/normalise";
import type { CanonicalEvent, CanonicalTeam } from "@sports-insights/normalise";
import { findNbaTeamById, findNbaTeamByKey, NBA_TEAMS, nbaTeamFullName } from "./teams.js";

const PROVIDER = "nba.com";
const DEFAULT_STATS_BASE = "https://stats.nba.com/stats";
const LIVE_SCOREBOARD_URL = "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json";

export interface NbaComProviderConfig {
  statsBaseUrl?: string;
  timeoutMs?: number;
}

interface StatsResultSet {
  name: string;
  headers: string[];
  rowSet: unknown[][];
}

interface StatsApiResponse {
  resultSets?: StatsResultSet[];
  resultSet?: StatsResultSet;
}

export interface NbaComPlayerGameStat {
  PlayerID: number;
  Name: string;
  Position?: string;
  Day: string;
  OpponentID: number;
  Points?: number;
  Rebounds?: number;
  Assists?: number;
  Minutes?: number;
}

const NBA_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

function toTeam(teamId: number, key: string, name: string): CanonicalTeam {
  return {
    provider: PROVIDER,
    providerId: String(teamId),
    name,
    shortName: key,
    sport: "basketball",
  };
}

/** Preserve NBA game id format (e.g. 0022501186). */
function normalizeNbaGameId(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^\d+$/.test(raw)) return raw.padStart(10, "0");
  return raw;
}

function nbaGameToEvent(game: NbaGame, competitionProviderId: string): CanonicalEvent {
  return {
    provider: PROVIDER,
    providerId: normalizeNbaGameId(game.gameId),
    competitionProviderId,
    homeTeam: toTeam(game.homeTeamId, game.homeTeamKey, game.homeTeamName),
    awayTeam: toTeam(game.awayTeamId, game.awayTeamKey, game.awayTeamName),
    scheduledAt: game.gameDatetime ? new Date(game.gameDatetime) : new Date(game.gameDate),
    status: game.status,
    sport: "basketball",
    homeScore: game.homeScore,
    awayScore: game.awayScore,
  };
}

/** NBA season string e.g. "2025-26" (season starts in October). */
export function getNbaSeasonString(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function getNbaSeasonStartYear(date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 9 ? year : year - 1;
}

function formatScoreboardDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function rowsToObjects(resultSet: StatsResultSet | undefined): Record<string, unknown>[] {
  if (!resultSet?.headers?.length) return [];
  return resultSet.rowSet.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < resultSet.headers.length; i++) {
      obj[resultSet.headers[i]!] = row[i];
    }
    return obj;
  });
}

function pickResultSet(payload: StatsApiResponse, name?: string): StatsResultSet | undefined {
  if (payload.resultSet) return payload.resultSet;
  if (!payload.resultSets?.length) return undefined;
  if (!name) return payload.resultSets[0];
  return payload.resultSets.find((set) => set.name === name) ?? payload.resultSets[0];
}

async function fetchStatsJson(
  statsBaseUrl: string,
  endpoint: string,
  params: Record<string, string>,
  timeoutMs: number,
): Promise<StatsApiResponse> {
  const url = new URL(`${statsBaseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: NBA_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`NBA.com stats request failed (${response.status}) ${endpoint}: ${body.slice(0, 200)}`);
    }

    return (await response.json()) as StatsApiResponse;
  } finally {
    clearTimeout(timer);
  }
}

function parseMatchupHomeAway(matchup: string): "HOME" | "AWAY" {
  return matchup.includes(" vs.") ? "HOME" : "AWAY";
}

function parseOpponentFromMatchup(matchup: string): string {
  const parts = matchup.split(/\s+(?:vs\.|@)\s+/);
  return (parts[1] ?? matchup).trim();
}

function mapStatus(gameStatusText?: string, gameStatus?: number): string {
  if (gameStatus === 3 || /final/i.test(gameStatusText ?? "")) return "Final";
  if (gameStatus === 2 || /progress|quarter|half|ot/i.test(gameStatusText ?? "")) return "InProgress";
  return "Scheduled";
}

export function createNbaComProvider(config: NbaComProviderConfig = {}) {
  const statsBaseUrl = config.statsBaseUrl ?? process.env.NBA_STATS_BASE_URL ?? DEFAULT_STATS_BASE;
  const timeoutMs = config.timeoutMs ?? Number(process.env.NBA_STATS_TIMEOUT_MS ?? 20_000);

  async function getTeamGameLog(teamId: string, season: string) {
    // LeagueGameFinder includes PLUS_MINUS so we can derive opponent points
    const payload = await fetchStatsJson(
      statsBaseUrl,
      "leaguegamefinder",
      {
        PlayerOrTeam: "T",
        LeagueID: "00",
        Season: season,
        SeasonType: "Regular Season",
        TeamID: teamId,
      },
      timeoutMs,
    );
    return rowsToObjects(pickResultSet(payload, "LeagueGameFinderResults"));
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
      const today = new Date();
      const isToday =
        date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate();

      if (isToday) {
        try {
          const response = await fetch(LIVE_SCOREBOARD_URL, {
            headers: { Accept: "application/json", "User-Agent": NBA_HEADERS["User-Agent"]! },
          });
          if (response.ok) {
            const live = (await response.json()) as {
              scoreboard?: {
                games?: Array<{
                  gameId: string;
                  gameStatus: number;
                  gameStatusText: string;
                  gameTimeUTC?: string;
                  homeTeam: { teamId: number; teamTricode: string; teamName: string; teamCity: string; score?: number };
                  awayTeam: { teamId: number; teamTricode: string; teamName: string; teamCity: string; score?: number };
                }>;
              };
            };

            return (live.scoreboard?.games ?? []).map((game) => ({
              gameId: Number(game.gameId),
              seasonYear: getNbaSeasonStartYear(date),
              seasonType: "REG",
              gameDate: date.toISOString().slice(0, 10),
              gameDatetime: game.gameTimeUTC,
              homeTeamId: game.homeTeam.teamId,
              awayTeamId: game.awayTeam.teamId,
              homeTeamKey: game.homeTeam.teamTricode,
              awayTeamKey: game.awayTeam.teamTricode,
              homeTeamName: `${game.homeTeam.teamCity} ${game.homeTeam.teamName}`.trim(),
              awayTeamName: `${game.awayTeam.teamCity} ${game.awayTeam.teamName}`.trim(),
              homeScore: game.homeTeam.score,
              awayScore: game.awayTeam.score,
              status: mapStatus(game.gameStatusText, game.gameStatus),
            }));
          }
        } catch {
          // Fall through to ScoreboardV2
        }
      }

      const payload = await fetchStatsJson(
        statsBaseUrl,
        "scoreboardv2",
        {
          GameDate: formatScoreboardDate(date),
          LeagueID: "00",
          DayOffset: "0",
        },
        timeoutMs,
      );

      const gameHeader = rowsToObjects(pickResultSet(payload, "GameHeader"));
      const lineScore = rowsToObjects(pickResultSet(payload, "LineScore"));

      return gameHeader.map((header) => {
        const gameId = Number(header.GAME_ID);
        const homeId = Number(header.HOME_TEAM_ID);
        const awayId = Number(header.VISITOR_TEAM_ID);
        const homeLine = lineScore.find((row) => Number(row.TEAM_ID) === homeId && Number(row.GAME_ID) === gameId);
        const awayLine = lineScore.find((row) => Number(row.TEAM_ID) === awayId && Number(row.GAME_ID) === gameId);
        const homeMeta = findNbaTeamById(homeId);
        const awayMeta = findNbaTeamById(awayId);

        return {
          gameId,
          seasonYear: getNbaSeasonStartYear(date),
          seasonType: "REG",
          gameDate: String(header.GAME_DATE_EST ?? date.toISOString()).slice(0, 10),
          gameDatetime: header.GAME_DATE_EST ? String(header.GAME_DATE_EST) : undefined,
          homeTeamId: homeId,
          awayTeamId: awayId,
          homeTeamKey: homeMeta?.key ?? String(homeLine?.TEAM_ABBREVIATION ?? homeId),
          awayTeamKey: awayMeta?.key ?? String(awayLine?.TEAM_ABBREVIATION ?? awayId),
          homeTeamName: homeMeta ? nbaTeamFullName(homeMeta) : String(homeLine?.TEAM_NAME ?? homeId),
          awayTeamName: awayMeta ? nbaTeamFullName(awayMeta) : String(awayLine?.TEAM_NAME ?? awayId),
          homeScore: homeLine?.PTS != null ? Number(homeLine.PTS) : undefined,
          awayScore: awayLine?.PTS != null ? Number(awayLine.PTS) : undefined,
          status: mapStatus(String(header.GAME_STATUS_TEXT ?? ""), Number(header.GAME_STATUS_ID)),
          channel: header.NATL_TV_BROADCASTER_ABBREVIATION
            ? String(header.NATL_TV_BROADCASTER_ABBREVIATION)
            : undefined,
        } satisfies NbaGame;
      });
    },

    async getSchedules(competitionProviderId: string, date: Date): Promise<CanonicalEvent[]> {
      const games = await this.getGamesByDate(date);
      return games.map((game) => nbaGameToEvent(game, competitionProviderId));
    },

    /**
     * Full regular-season game list via LeagueGameLog (one request).
     * Returns completed games for the season (~1,230 for a full season).
     */
    async getSeasonGames(competitionProviderId = "nba", season?: string): Promise<CanonicalEvent[]> {
      const seasonStr = season ?? getNbaSeasonString();
      const payload = await fetchStatsJson(
        statsBaseUrl,
        "leaguegamelog",
        {
          Counter: "0",
          Direction: "DESC",
          LeagueID: "00",
          PlayerOrTeam: "T",
          Season: seasonStr,
          SeasonType: "Regular Season",
          Sorter: "DATE",
        },
        timeoutMs,
      );

      const rows = rowsToObjects(pickResultSet(payload, "LeagueGameLog"));
      const byGame = new Map<string, { home?: Record<string, unknown>; away?: Record<string, unknown> }>();

      for (const row of rows) {
        const gameId = normalizeNbaGameId(row.GAME_ID);
        const matchup = String(row.MATCHUP ?? "");
        const entry = byGame.get(gameId) ?? {};
        if (matchup.includes(" vs.")) entry.home = row;
        else entry.away = row;
        byGame.set(gameId, entry);
      }

      const events: CanonicalEvent[] = [];

      for (const [gameId, sides] of byGame) {
        const homeRow = sides.home;
        const awayRow = sides.away;
        if (!homeRow || !awayRow) continue;

        const homeId = Number(homeRow.TEAM_ID);
        const awayId = Number(awayRow.TEAM_ID);
        const homeMeta = findNbaTeamById(homeId);
        const awayMeta = findNbaTeamById(awayId);
        const dateStr = String(homeRow.GAME_DATE ?? awayRow.GAME_DATE ?? "");

        events.push({
          provider: PROVIDER,
          providerId: gameId,
          competitionProviderId,
          homeTeam: toTeam(
            homeId,
            homeMeta?.key ?? String(homeRow.TEAM_ABBREVIATION ?? homeId),
            homeMeta ? nbaTeamFullName(homeMeta) : String(homeRow.TEAM_NAME ?? homeId),
          ),
          awayTeam: toTeam(
            awayId,
            awayMeta?.key ?? String(awayRow.TEAM_ABBREVIATION ?? awayId),
            awayMeta ? nbaTeamFullName(awayMeta) : String(awayRow.TEAM_NAME ?? awayId),
          ),
          scheduledAt: dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date(),
          status: "Final",
          sport: "basketball",
          homeScore: homeRow.PTS != null ? Number(homeRow.PTS) : undefined,
          awayScore: awayRow.PTS != null ? Number(awayRow.PTS) : undefined,
        });
      }

      return events.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
    },

    /** Scoreboard games across an inclusive date range (upcoming + recent). */
    async getGamesByDateRange(start: Date, end: Date, competitionProviderId = "nba"): Promise<CanonicalEvent[]> {
      const events: CanonicalEvent[] = [];
      const seen = new Set<string>();
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      const delayMs = Number(process.env.NBA_STATS_DAY_DELAY_MS ?? 250);

      while (cursor <= last) {
        try {
          const dayGames = await this.getSchedules(competitionProviderId, new Date(cursor));
          for (const game of dayGames) {
            const id = normalizeNbaGameId(game.providerId);
            if (seen.has(id)) continue;
            seen.add(id);
            events.push({ ...game, providerId: id });
          }
        } catch {
          // Skip days that fail (rate limit / empty) and continue the range
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        if (delayMs > 0 && cursor <= last) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      return events.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    },

    /** Historical matchups between two teams via LeagueGameFinder. */
    async getHeadToHeadEvents(
      homeTeamProviderId: string,
      awayTeamProviderId: string,
      competitionProviderId = "nba",
      season?: string,
    ): Promise<CanonicalEvent[]> {
      const seasonStr = season ?? getNbaSeasonString();
      const payload = await fetchStatsJson(
        statsBaseUrl,
        "leaguegamefinder",
        {
          PlayerOrTeam: "T",
          LeagueID: "00",
          Season: seasonStr,
          SeasonType: "Regular Season",
          TeamID: homeTeamProviderId,
          VsTeamID: awayTeamProviderId,
        },
        timeoutMs,
      );

      const rows = rowsToObjects(pickResultSet(payload, "LeagueGameFinderResults"));
      const byGame = new Map<string, { home?: Record<string, unknown>; away?: Record<string, unknown> }>();

      for (const row of rows) {
        const gameId = String(row.GAME_ID);
        const matchup = String(row.MATCHUP ?? "");
        const entry = byGame.get(gameId) ?? {};
        if (matchup.includes(" vs.")) entry.home = row;
        else entry.away = row;
        byGame.set(gameId, entry);
      }

      const homeMeta = findNbaTeamById(homeTeamProviderId);
      const awayMeta = findNbaTeamById(awayTeamProviderId);
      const events: CanonicalEvent[] = [];

      for (const [gameId, sides] of byGame) {
        const homeRow = sides.home;
        const awayRow = sides.away;
        if (!homeRow && !awayRow) continue;

        const dateStr = String((homeRow ?? awayRow)?.GAME_DATE ?? "");
        const homePts = homeRow?.PTS != null
          ? Number(homeRow.PTS)
          : awayRow?.PTS != null && awayRow?.PLUS_MINUS != null
            ? Number(awayRow.PTS) - Number(awayRow.PLUS_MINUS)
            : undefined;
        const awayPts = awayRow?.PTS != null
          ? Number(awayRow.PTS)
          : homeRow?.PTS != null && homeRow?.PLUS_MINUS != null
            ? Number(homeRow.PTS) - Number(homeRow.PLUS_MINUS)
            : undefined;

        events.push({
          provider: PROVIDER,
          providerId: gameId,
          competitionProviderId,
          homeTeam: toTeam(
            Number(homeTeamProviderId),
            homeMeta?.key ?? "HOME",
            homeMeta ? nbaTeamFullName(homeMeta) : "Home",
          ),
          awayTeam: toTeam(
            Number(awayTeamProviderId),
            awayMeta?.key ?? "AWAY",
            awayMeta ? nbaTeamFullName(awayMeta) : "Away",
          ),
          scheduledAt: dateStr ? new Date(dateStr) : new Date(),
          status: "Final",
          sport: "basketball",
          homeScore: homePts,
          awayScore: awayPts,
        });
      }

      return events.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
    },

    async getStandings(season?: number): Promise<NbaStanding[]> {
      const seasonStart = season ?? getNbaSeasonStartYear();
      const seasonStr = `${seasonStart}-${String(seasonStart + 1).slice(-2)}`;
      const payload = await fetchStatsJson(
        statsBaseUrl,
        "leaguestandingsv3",
        {
          LeagueID: "00",
          Season: seasonStr,
          SeasonType: "Regular Season",
        },
        timeoutMs,
      );

      const rows = rowsToObjects(pickResultSet(payload, "Standings"));
      return rows.map((row) => {
        const teamId = Number(row.TeamID ?? row.TEAM_ID);
        const meta = findNbaTeamById(teamId);
        const wins = Number(row.WINS ?? row.W ?? 0);
        const losses = Number(row.LOSSES ?? row.L ?? 0);
        const played = wins + losses;
        return {
          teamId,
          teamKey: meta?.key ?? String(row.TeamName ?? teamId),
          teamName: meta ? nbaTeamFullName(meta) : String(row.TeamName ?? teamId),
          wins,
          losses,
          winPct: played ? wins / played : Number(row.WinPCT ?? row.W_PCT ?? 0),
          conferenceRank: row.PlayoffRank != null ? Number(row.PlayoffRank) : undefined,
          divisionRank: row.DivisionRank != null ? Number(row.DivisionRank) : undefined,
          gamesBack: row.ConferenceGamesBack != null ? Number(row.ConferenceGamesBack) : undefined,
        } satisfies NbaStanding;
      });
    },

    async getTeamGameStats(teamProviderId: string, lastN: number, season?: string): Promise<BasketballTeamStats> {
      const seasonStr = season ?? getNbaSeasonString();
      const meta = findNbaTeamById(teamProviderId);
      const rows = await getTeamGameLog(teamProviderId, seasonStr);

      const recentResults: BasketballMatchResult[] = rows
        .map((row) => {
          const pointsFor = Number(row.PTS ?? 0);
          const plusMinus = Number(row.PLUS_MINUS ?? 0);
          const pointsAgainst = pointsFor - plusMinus;
          const wl = String(row.WL ?? "").toUpperCase();
          const matchup = String(row.MATCHUP ?? "");
          return {
            opponent: parseOpponentFromMatchup(matchup),
            result: (wl === "W" ? "W" : "L") as "W" | "L",
            pointsFor,
            pointsAgainst,
            date: String(row.GAME_DATE ?? ""),
            homeOrAway: parseMatchupHomeAway(matchup),
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, lastN);

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

    async getPlayerGameStatsByTeam(teamProviderId: string, season?: string): Promise<NbaComPlayerGameStat[]> {
      const seasonStr = season ?? getNbaSeasonString();
      const payload = await fetchStatsJson(
        statsBaseUrl,
        "playergamelogs",
        {
          LeagueID: "00",
          Season: seasonStr,
          SeasonType: "Regular Season",
          TeamID: teamProviderId,
        },
        timeoutMs,
      );

      const rows = rowsToObjects(pickResultSet(payload, "PlayerGameLogs"));
      return rows.map((row) => {
        const matchup = String(row.MATCHUP ?? "");
        const oppKey = parseOpponentFromMatchup(matchup);
        const opp = findNbaTeamByKey(oppKey);
        const minutesRaw = row.MIN;
        let minutes: number | undefined;
        if (typeof minutesRaw === "number") minutes = minutesRaw;
        else if (typeof minutesRaw === "string" && minutesRaw.includes(":")) {
          const [m, s] = minutesRaw.split(":").map(Number);
          minutes = (m ?? 0) + (s ?? 0) / 60;
        }

        return {
          PlayerID: Number(row.PLAYER_ID),
          Name: String(row.PLAYER_NAME ?? "Unknown"),
          Day: String(row.GAME_DATE ?? ""),
          OpponentID: opp?.teamId ?? 0,
          Points: row.PTS != null ? Number(row.PTS) : undefined,
          Rebounds: row.REB != null ? Number(row.REB) : undefined,
          Assists: row.AST != null ? Number(row.AST) : undefined,
          Minutes: minutes,
        } satisfies NbaComPlayerGameStat;
      });
    },
  };
}

export type NbaComProvider = ReturnType<typeof createNbaComProvider>;
