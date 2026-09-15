import type { CanonicalTeam } from "./models.js";

export interface BasketballMatchResult {
  opponent: string;
  result: "W" | "L";
  pointsFor: number;
  pointsAgainst: number;
  date: string;
  homeOrAway?: "HOME" | "AWAY";
}

export interface BasketballTeamStats {
  team: CanonicalTeam;
  recentResults: BasketballMatchResult[];
  pointsScored: number;
  pointsConceded: number;
  avgPointsFor: number;
  avgPointsAgainst: number;
}

export interface BasketballHeadToHeadMeeting {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner?: "home" | "away";
}

export interface BasketballHeadToHeadStats {
  homeTeamWins: number;
  awayTeamWins: number;
  meetings: BasketballHeadToHeadMeeting[];
  avgTotalPoints: number;
}

export interface BasketballPlayerGameLine {
  playerId: number;
  fullName: string;
  position?: string;
  gameDate: string;
  opponent: string;
  points: number;
  rebounds: number;
  assists: number;
  minutes?: number;
}

export interface BasketballPlayerSpotlight {
  playerId: number;
  fullName: string;
  position?: string;
  teamName: string;
  lastGames: BasketballPlayerGameLine[];
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
}

export interface BasketballGamePreview {
  venueName?: string;
  venueCity?: string;
  channel?: string;
  homeRecord: string;
  awayRecord: string;
  homeAvgPoints: number;
  awayAvgPoints: number;
  homeConferenceRank?: number;
  awayConferenceRank?: number;
  label: string;
}

export interface NbaTeamProfile {
  teamId: number;
  key: string;
  name: string;
  city?: string;
  conference?: string;
  division?: string;
  primaryColor?: string;
  secondaryColor?: string;
  headCoach?: string;
  venueId?: number;
}

export interface NbaGame {
  gameId: number;
  seasonYear: number;
  seasonType: string;
  gameDate: string;
  gameDatetime?: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamKey: string;
  awayTeamKey: string;
  homeTeamName: string;
  awayTeamName: string;
  venueId?: number;
  venueName?: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
  channel?: string;
  neutralVenue?: boolean;
}

export interface NbaStanding {
  teamId: number;
  teamKey: string;
  teamName: string;
  wins: number;
  losses: number;
  winPct: number;
  conferenceRank?: number;
  divisionRank?: number;
  gamesBack?: number;
}
