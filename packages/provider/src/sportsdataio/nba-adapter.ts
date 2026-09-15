const PROVIDER = "sportsdataio";

interface NbaTeamResponse {
  TeamID: number;
  Key: string;
  City: string;
  Name: string;
  Conference: string;
  Division: string;
  PrimaryColor?: string;
  SecondaryColor?: string;
  HeadCoach?: string;
  StadiumID?: number;
}

interface NbaVenueResponse {
  StadiumID: number;
  Name: string;
  City?: string;
  State?: string;
  Country?: string;
  Capacity?: number;
}

interface NbaGameResponse {
  GameID: number;
  Season: number;
  SeasonType: number;
  Day: string;
  DateTime: string;
  Status: string;
  HomeTeamID: number;
  AwayTeamID: number;
  HomeTeam: string;
  AwayTeam: string;
  HomeTeamScore?: number;
  AwayTeamScore?: number;
  StadiumID?: number;
  Channel?: string;
  NeutralVenue?: boolean;
  Quarter?: string;
  TimeRemainingMinutes?: number;
  TimeRemainingSeconds?: number;
  Attendance?: number;
  IsOverTime?: boolean;
}

interface NbaStandingResponse {
  TeamID: number;
  Key: string;
  City: string;
  Name: string;
  Wins: number;
  Losses: number;
  Percentage: number;
  ConferenceRank?: number;
  DivisionRank?: number;
  GamesBack?: number;
  HomeWins?: number;
  HomeLosses?: number;
  AwayWins?: number;
  AwayLosses?: number;
}

interface NbaTeamGameStatsResponse {
  GameID: number;
  TeamID: number;
  OpponentID: number;
  Season: number;
  Day: string;
  HomeOrAway: string;
  Points: number;
  OpponentPoints: number;
  Rebounds: number;
  Assists: number;
  FieldGoalsPercentage?: number;
  ThreePointersPercentage?: number;
  Wins?: number;
  Losses?: number;
}

interface NbaPlayerGameStatsResponse {
  GameID: number;
  PlayerID: number;
  TeamID: number;
  OpponentID: number;
  Season: number;
  Day: string;
  HomeOrAway: string;
  Started?: number;
  Minutes?: number;
  Points?: number;
  Rebounds?: number;
  Assists?: number;
  Steals?: number;
  Blocks?: number;
  Turnovers?: number;
  FieldGoalsMade?: number;
  FieldGoalsAttempted?: number;
  ThreePointersMade?: number;
  ThreePointersAttempted?: number;
  FreeThrowsMade?: number;
  FreeThrowsAttempted?: number;
  PlusMinus?: number;
  Name: string;
  Position?: string;
}

import type {
  BasketballHeadToHeadStats,
  BasketballMatchResult,
  BasketballTeamStats,
  NbaGame,
  NbaStanding,
  NbaTeamProfile,
} from "@sports-insights/normalise";
import type { CanonicalEvent, CanonicalTeam } from "@sports-insights/normalise";
import type { ProviderConfig } from "../types.js";

const SEASON_TYPE_MAP: Record<number, string> = {
  1: "PRE",
  2: "REG",
  3: "POST",
  4: "IST",
  5: "EXH",
};

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });

  if (response.status === 404) {
    return [] as T;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SportsDataIO NBA request failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

function toTeam(teamId: number, key: string, name: string): CanonicalTeam {
  return {
    provider: PROVIDER,
    providerId: String(teamId),
    name,
    shortName: key,
    sport: "basketball",
  };
}

function formatNbaDate(date: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const year = date.getFullYear();
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapGame(game: NbaGameResponse): NbaGame {
  return {
    gameId: game.GameID,
    seasonYear: game.Season,
    seasonType: SEASON_TYPE_MAP[game.SeasonType] ?? "REG",
    gameDate: game.Day.slice(0, 10),
    gameDatetime: game.DateTime,
    homeTeamId: game.HomeTeamID,
    awayTeamId: game.AwayTeamID,
    homeTeamKey: game.HomeTeam,
    awayTeamKey: game.AwayTeam,
    homeTeamName: game.HomeTeam,
    awayTeamName: game.AwayTeam,
    venueId: game.StadiumID,
    homeScore: game.HomeTeamScore,
    awayScore: game.AwayTeamScore,
    status: game.Status,
    channel: game.Channel,
    neutralVenue: game.NeutralVenue,
  };
}

function mapGameToEvent(game: NbaGameResponse, competitionProviderId: string): CanonicalEvent {
  return {
    provider: PROVIDER,
    providerId: String(game.GameID),
    competitionProviderId,
    homeTeam: toTeam(game.HomeTeamID, game.HomeTeam, game.HomeTeam),
    awayTeam: toTeam(game.AwayTeamID, game.AwayTeam, game.AwayTeam),
    scheduledAt: new Date(game.DateTime),
    status: game.Status,
    sport: "basketball",
    homeScore: game.HomeTeamScore,
    awayScore: game.AwayTeamScore,
  };
}

export function createNbaProvider(config: ProviderConfig) {
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl ?? "https://api.sportsdata.io/v3/nba/scores/json";

  return {
    async getTeams(): Promise<NbaTeamProfile[]> {
      const teams = await fetchJson<NbaTeamResponse[]>(`${baseUrl}/Teams`, apiKey);
      return teams.map((team) => ({
        teamId: team.TeamID,
        key: team.Key,
        name: `${team.City} ${team.Name}`.trim(),
        city: team.City,
        conference: team.Conference,
        division: team.Division,
        primaryColor: team.PrimaryColor,
        secondaryColor: team.SecondaryColor,
        headCoach: team.HeadCoach,
        venueId: team.StadiumID,
      }));
    },

    async getVenues(): Promise<Array<{ venueId: number; name: string; city?: string; state?: string; country?: string; capacity?: number }>> {
      const venues = await fetchJson<NbaVenueResponse[]>(`${baseUrl}/Stadiums`, apiKey);
      return venues.map((venue) => ({
        venueId: venue.StadiumID,
        name: venue.Name,
        city: venue.City,
        state: venue.State,
        country: venue.Country,
        capacity: venue.Capacity,
      }));
    },

    async getGamesByDate(date: Date): Promise<NbaGame[]> {
      const games = await fetchJson<NbaGameResponse[]>(
        `${baseUrl}/GamesByDate/${formatNbaDate(date)}`,
        apiKey,
      );
      return games.map(mapGame);
    },

    async getSchedules(competitionProviderId: string, date: Date): Promise<CanonicalEvent[]> {
      const games = await fetchJson<NbaGameResponse[]>(
        `${baseUrl}/GamesByDate/${formatNbaDate(date)}`,
        apiKey,
      );
      return games.map((game) => mapGameToEvent(game, competitionProviderId));
    },

    async getStandings(season: number): Promise<NbaStanding[]> {
      const standings = await fetchJson<NbaStandingResponse[]>(`${baseUrl}/Standings/${season}`, apiKey);
      return standings.map((row) => ({
        teamId: row.TeamID,
        teamKey: row.Key,
        teamName: `${row.City} ${row.Name}`.trim(),
        wins: row.Wins,
        losses: row.Losses,
        winPct: row.Percentage,
        conferenceRank: row.ConferenceRank,
        divisionRank: row.DivisionRank,
        gamesBack: row.GamesBack,
      }));
    },

    async getTeamGameStats(teamProviderId: string, lastN: number, season?: number): Promise<BasketballTeamStats> {
      const seasonYear = season ?? new Date().getFullYear();
      const games = await fetchJson<NbaTeamGameStatsResponse[]>(
        `${baseUrl}/TeamGameStatsBySeason/${teamProviderId}/${seasonYear}`,
        apiKey,
      );

      const completed = games
        .filter((g) => g.Points != null)
        .sort((a, b) => new Date(b.Day).getTime() - new Date(a.Day).getTime())
        .slice(0, lastN);

      const teamName = completed[0]?.TeamID === Number(teamProviderId)
        ? "Team"
        : "Team";

      const recentResults: BasketballMatchResult[] = completed.map((game) => {
        const pointsFor = game.Points ?? 0;
        const pointsAgainst = game.OpponentPoints ?? 0;
        let result: "W" | "L" = "L";
        if (pointsFor > pointsAgainst) result = "W";

        return {
          opponent: String(game.OpponentID),
          result,
          pointsFor,
          pointsAgainst,
          date: game.Day,
          homeOrAway: game.HomeOrAway as "HOME" | "AWAY",
        };
      });

      const pointsScored = recentResults.reduce((sum, r) => sum + r.pointsFor, 0);
      const pointsConceded = recentResults.reduce((sum, r) => sum + r.pointsAgainst, 0);
      const count = recentResults.length || 1;

      return {
        team: toTeam(Number(teamProviderId), teamName, teamName),
        recentResults,
        pointsScored,
        pointsConceded,
        avgPointsFor: Math.round((pointsScored / count) * 10) / 10,
        avgPointsAgainst: Math.round((pointsConceded / count) * 10) / 10,
      };
    },

    async getPlayerGameStatsByTeam(teamProviderId: string, season?: number) {
      const seasonYear = season ?? new Date().getFullYear();
      return fetchJson<NbaPlayerGameStatsResponse[]>(
        `${baseUrl}/PlayerGameStatsByTeam/${seasonYear}/${teamProviderId}`,
        apiKey,
      );
    },
  };
}

export function deriveBasketballHeadToHeadFromGames(
  homeTeamName: string,
  games: CanonicalEvent[],
): BasketballHeadToHeadStats {
  const meetings = games
    .filter((g) => g.status === "Final")
    .map((game) => {
      const homeScore = game.homeScore ?? 0;
      const awayScore = game.awayScore ?? 0;
      let winner: "home" | "away" | undefined;
      if (homeScore > awayScore) winner = "home";
      else if (awayScore > homeScore) winner = "away";

      return {
        date: game.scheduledAt.toISOString(),
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        homeScore,
        awayScore,
        winner,
      };
    });

  let homeTeamWins = 0;
  let awayTeamWins = 0;
  let totalPoints = 0;

  for (const meeting of meetings) {
    totalPoints += meeting.homeScore + meeting.awayScore;
    const homeSideIsNamedTeam = meeting.homeTeam === homeTeamName;
    if (meeting.winner === "home") {
      if (homeSideIsNamedTeam) homeTeamWins++;
      else awayTeamWins++;
    } else if (meeting.winner === "away") {
      if (homeSideIsNamedTeam) awayTeamWins++;
      else homeTeamWins++;
    }
  }

  return {
    homeTeamWins,
    awayTeamWins,
    meetings,
    avgTotalPoints: meetings.length ? Math.round((totalPoints / meetings.length) * 10) / 10 : 0,
  };
}
