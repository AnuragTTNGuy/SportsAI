import type { AreasCatalog } from "@sports-insights/normalise";
import type { ProviderConfig, SportsDataProvider } from "../types.js";
import type {
  CanonicalCompetition,
  CanonicalEvent,
  CanonicalLineup,
  CanonicalStanding,
  CanonicalTeam,
  CanonicalTeamStats,
  MatchResult,
} from "@sports-insights/normalise";

const PROVIDER = "sportsdataio";

interface SportsDataIoArea {
  AreaId: number;
  CountryCode: string;
  Name: string;
  Competitions?: SportsDataIoCompetitionNested[];
}

interface SportsDataIoCompetitionNested {
  CompetitionId: number;
  AreaId: number;
  AreaName?: string;
  Name: string;
  Gender?: string;
  Type?: string;
  Format?: string;
  Key?: string;
  Seasons?: SportsDataIoSeason[];
}

interface SportsDataIoSeason {
  SeasonId: number;
  CompetitionId: number;
  Season: number;
  Name: string;
  CompetitionName?: string;
  StartDate?: string;
  EndDate?: string;
  CurrentSeason?: boolean;
  Rounds?: SportsDataIoRound[];
}

interface SportsDataIoRound {
  RoundId: number;
  SeasonId: number;
  Season?: number;
  Name: string;
  Type?: string;
  StartDate?: string;
  EndDate?: string;
  CurrentRound?: boolean;
}

interface SportsDataIoGame {
  GameId: number;
  CompetitionId: number;
  Season: number;
  RoundId?: number;
  DateTime: string;
  Status: string;
  HomeTeamId: number;
  AwayTeamId: number;
  HomeTeamName: string;
  AwayTeamName: string;
  HomeTeamScore?: number;
  AwayTeamScore?: number;
  HomeTeamScorePeriod1?: number;
  AwayTeamScorePeriod1?: number;
}

interface SportsDataIoStanding {
  TeamId: number;
  Name: string;
  Order: number;
  Games: number;
  Wins: number;
  Draws: number;
  Losses: number;
  GoalsScored: number;
  GoalsAgainst: number;
  Points: number;
}

interface SportsDataIoLineupPlayer {
  PlayerId: number;
  Name: string;
  Position?: string;
  Jersey?: number;
}

interface SportsDataIoLineup {
  TeamId: number;
  Team: string;
  Formation?: string;
  StartingLineup?: SportsDataIoLineupPlayer[];
  Confirmed?: boolean;
}

function toTeam(teamId: number, name: string, key?: string): CanonicalTeam {
  return {
    provider: PROVIDER,
    providerId: String(teamId),
    name,
    shortName: key,
    sport: "football",
  };
}

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SportsDataIO request failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

function mapGameToEvent(game: SportsDataIoGame): CanonicalEvent {
  return {
    provider: PROVIDER,
    providerId: String(game.GameId),
    competitionProviderId: String(game.CompetitionId),
    homeTeam: toTeam(game.HomeTeamId, game.HomeTeamName),
    awayTeam: toTeam(game.AwayTeamId, game.AwayTeamName),
    scheduledAt: new Date(game.DateTime),
    status: game.Status,
    sport: "football",
    homeScore: game.HomeTeamScore,
    awayScore: game.AwayTeamScore,
    homeScoreHt: game.HomeTeamScorePeriod1,
    awayScoreHt: game.AwayTeamScorePeriod1,
  };
}

async function fetchGamesByDate(baseUrl: string, apiKey: string, date: Date): Promise<SportsDataIoGame[]> {
  const dateStr = formatDate(date);
  const url = `${baseUrl}/scores/json/GamesByDate/${dateStr}`;
  const response = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });

  if (response.status === 404) {
    console.warn(`No games returned from SportsDataIO for ${dateStr} (endpoint not available on your plan)`);
    return [];
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SportsDataIO request failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<SportsDataIoGame[]>;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normaliseAreas(data: SportsDataIoArea[]): AreasCatalog {
  return {
    areas: data.map((area) => ({
      provider: PROVIDER,
      providerId: String(area.AreaId),
      countryCode: area.CountryCode,
      name: area.Name,
      sport: "football",
      competitions: (area.Competitions ?? []).map((comp) => ({
        provider: PROVIDER,
        providerId: String(comp.CompetitionId),
        areaProviderId: String(area.AreaId),
        name: comp.Name,
        sport: "football",
        key: comp.Key,
        gender: comp.Gender,
        competitionType: comp.Type,
        format: comp.Format,
        seasons: (comp.Seasons ?? []).map((season) => ({
          provider: PROVIDER,
          providerId: String(season.SeasonId),
          competitionProviderId: String(comp.CompetitionId),
          season: season.Season,
          name: season.Name,
          currentSeason: Boolean(season.CurrentSeason),
          startDate: season.StartDate,
          endDate: season.EndDate,
          rounds: (season.Rounds ?? []).map((round) => ({
            provider: PROVIDER,
            providerId: String(round.RoundId),
            seasonProviderId: String(season.SeasonId),
            name: round.Name,
            roundType: round.Type,
            currentRound: Boolean(round.CurrentRound),
            startDate: round.StartDate,
            endDate: round.EndDate,
          })),
        })),
      })),
    })),
  };
}

export function createSportsDataIoProvider(config: ProviderConfig): SportsDataProvider {
  const { apiKey, baseUrl } = config;

  return {
    name: PROVIDER,

    async getAreas(): Promise<AreasCatalog> {
      const data = await fetchJson<SportsDataIoArea[]>(
        `${baseUrl}/scores/json/Areas`,
        apiKey,
      );
      return normaliseAreas(data);
    },

    async getCompetitions(): Promise<CanonicalCompetition[]> {
      const catalog = await this.getAreas();
      return catalog.areas.flatMap((area) =>
        area.competitions.map((comp) => ({
          provider: comp.provider,
          providerId: comp.providerId,
          areaProviderId: comp.areaProviderId,
          name: comp.name,
          sport: comp.sport,
          key: comp.key,
          gender: comp.gender,
          competitionType: comp.competitionType,
          format: comp.format,
        })),
      );
    },

    async getSchedules(competitionProviderId: string, date: Date): Promise<CanonicalEvent[]> {
      const data = await fetchGamesByDate(baseUrl, apiKey, date);
      return data
        .filter((game) => String(game.CompetitionId) === competitionProviderId)
        .map(mapGameToEvent);
    },

    async getSchedulesByDate(date: Date): Promise<CanonicalEvent[]> {
      const data = await fetchGamesByDate(baseUrl, apiKey, date);
      return data.map(mapGameToEvent);
    },

    async getStandings(competitionProviderId: string): Promise<CanonicalStanding[]> {
      const season = new Date().getFullYear();
      const data = await fetchJson<SportsDataIoStanding[]>(
        `${baseUrl}/scores/json/Standings/${competitionProviderId}/${season}`,
        apiKey,
      );

      return data.map((row) => ({
        team: toTeam(row.TeamId, row.Name),
        position: row.Order,
        played: row.Games,
        won: row.Wins,
        drawn: row.Draws,
        lost: row.Losses,
        goalsFor: row.GoalsScored,
        goalsAgainst: row.GoalsAgainst,
        points: row.Points,
      }));
    },

    async getTeamStats(teamProviderId: string, lastN: number): Promise<CanonicalTeamStats> {
      const season = new Date().getFullYear();
      const games = await fetchJson<SportsDataIoGame[]>(
        `${baseUrl}/scores/json/TeamGameStatsBySeason/${teamProviderId}/${season}`,
        apiKey,
      );

      const completed = games
        .filter((g) => g.Status === "Final")
        .sort((a, b) => new Date(b.DateTime).getTime() - new Date(a.DateTime).getTime())
        .slice(0, lastN);

      const teamName = completed[0]?.HomeTeamId === Number(teamProviderId)
        ? completed[0]?.HomeTeamName
        : completed[0]?.AwayTeamName ?? "Unknown";

      const recentResults: MatchResult[] = completed.map((game) => {
        const isHome = String(game.HomeTeamId) === teamProviderId;
        const goalsFor = isHome ? (game.HomeTeamScore ?? 0) : (game.AwayTeamScore ?? 0);
        const goalsAgainst = isHome ? (game.AwayTeamScore ?? 0) : (game.HomeTeamScore ?? 0);
        const opponent = isHome ? game.AwayTeamName : game.HomeTeamName;
        let result: "W" | "D" | "L" = "D";
        if (goalsFor > goalsAgainst) result = "W";
        if (goalsFor < goalsAgainst) result = "L";

        return {
          opponent,
          result,
          goalsFor,
          goalsAgainst,
          goalsForHt: isHome ? game.HomeTeamScorePeriod1 : game.AwayTeamScorePeriod1,
          goalsAgainstHt: isHome ? game.AwayTeamScorePeriod1 : game.HomeTeamScorePeriod1,
          date: game.DateTime,
        };
      });

      const goalsScored = recentResults.reduce((sum, r) => sum + r.goalsFor, 0);
      const goalsConceded = recentResults.reduce((sum, r) => sum + r.goalsAgainst, 0);
      const bothTeamsScored = recentResults.filter(
        (r) => r.goalsFor > 0 && r.goalsAgainst > 0,
      ).length;

      return {
        team: toTeam(Number(teamProviderId), teamName),
        recentResults,
        goalsScored,
        goalsConceded,
        bothTeamsScoredRate: recentResults.length ? bothTeamsScored / recentResults.length : 0,
      };
    },

    async getLineups(eventProviderId: string): Promise<CanonicalLineup[]> {
      const data = await fetchJson<SportsDataIoLineup[]>(
        `${baseUrl}/scores/json/LineupsByGame/${eventProviderId}`,
        apiKey,
      );

      return data.map((lineup) => ({
        team: toTeam(lineup.TeamId, lineup.Team),
        formation: lineup.Formation,
        players: (lineup.StartingLineup ?? []).map((p) => ({
          name: p.Name,
          position: p.Position,
          number: p.Jersey,
        })),
        confirmed: Boolean(lineup.Confirmed),
      }));
    },
  };
}

export function deriveHeadToHeadFromGames(
  homeTeamName: string,
  _awayTeamName: string,
  games: CanonicalEvent[],
): import("@sports-insights/normalise").HeadToHeadStats {
  const meetings = games
    .filter((g) => g.status === "Final")
    .map((game) => {
      const homeScore = game.homeScore ?? 0;
      const awayScore = game.awayScore ?? 0;
      let winner: "home" | "away" | "draw" | undefined;
      if (homeScore > awayScore) winner = "home";
      else if (awayScore > homeScore) winner = "away";
      else winner = "draw";

      return {
        date: game.scheduledAt.toISOString(),
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        homeScore,
        awayScore,
        homeScoreHt: game.homeScoreHt,
        awayScoreHt: game.awayScoreHt,
        winner,
      };
    });

  let homeTeamWins = 0;
  let awayTeamWins = 0;
  let draws = 0;

  for (const meeting of meetings) {
    const homeSideIsFirstTeam = meeting.homeTeam === homeTeamName;
    if (meeting.winner === "draw") {
      draws++;
    } else if (
      (meeting.winner === "home" && homeSideIsFirstTeam) ||
      (meeting.winner === "away" && !homeSideIsFirstTeam)
    ) {
      homeTeamWins++;
    } else {
      awayTeamWins++;
    }
  }

  return { homeTeamWins, awayTeamWins, draws, meetings };
}
