export interface Competition {
  id: string;
  providerId: string;
  name: string;
  key?: string;
  gender?: string;
  type?: string;
  format?: string;
  areaName: string;
}

export interface EventSummary {
  id: string;
  competitionId: string;
  competitionName?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: string;
  status: string;
  sport: string;
}

export type SportSlug = "football" | "basketball";

export interface SportSummary {
  slug: SportSlug;
  name: string;
  description: string;
  competitionCount?: number;
}

export interface SportsCatalogResponse {
  generatedAt: string;
  sports: SportSummary[];
}

export type InsightCardType =
  | "form_guide"
  | "h2h"
  | "trend"
  | "over_under"
  | "correct_score"
  | "half_results"
  | "points_over_under"
  | "player_spotlight"
  | "game_preview";

export interface InsightCard {
  type: InsightCardType;
  title: string;
  evidenceIds: string[];
  payload: Record<string, unknown>;
}

export interface InsightResponse {
  eventId: string;
  generatedAt: string;
  freshness: Record<string, string>;
  cards: InsightCard[];
  stats: Record<string, unknown>;
  ladder: Record<string, unknown>;
  lineup: Record<string, unknown>;
}

export interface AreasCatalogResponse {
  generatedAt: string;
  areas: Array<{
    id: string;
    providerId: string;
    countryCode: string;
    name: string;
    competitions: Array<{
      id: string;
      providerId: string;
      name: string;
      key?: string;
      gender?: string;
      type?: string;
      format?: string;
    }>;
  }>;
}

export interface FormGuidePayload {
  teams: Array<{
    name: string;
    results: Array<"W" | "D" | "L">;
    goalsFor: number;
    goalsAgainst: number;
  }>;
  matchCount?: number;
}

export interface H2HPayload {
  summary: string;
  stats: { homeTeamWins: number; awayTeamWins: number; draws: number };
}

export interface TrendPayload {
  metric: string;
  value: number;
  label: string;
}

export interface OverUnderPayload {
  metric: "over_under_2_5";
  line: number;
  overRate: number;
  underRate: number;
  label: string;
  homeTeam: { overRate: number; avgTotalGoals: number };
  awayTeam: { overRate: number; avgTotalGoals: number };
  recommendation: "over" | "under" | "neutral";
}

export interface CorrectScorePrediction {
  score: string;
  probability: number;
  source: "h2h" | "form" | "combined";
}

export interface CorrectScorePayload {
  metric: "correct_score";
  predictions: CorrectScorePrediction[];
  label: string;
}

export interface HalfResultBreakdown {
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
}

export interface HalfResultsPayload {
  metric: "half_results";
  homeTeam: HalfResultBreakdown;
  awayTeam: HalfResultBreakdown;
  h2h: {
    homeWins: number;
    draws: number;
    awayWins: number;
    meetings: number;
  };
  label: string;
}

export interface BasketballFormGuidePayload {
  teams: Array<{
    name: string;
    results: Array<"W" | "L">;
    pointsFor: number;
    pointsAgainst: number;
    avgPointsFor: number;
    avgPointsAgainst: number;
  }>;
  matchCount: number;
}

export interface BasketballH2HPayload {
  summary: string;
  stats: {
    homeTeamWins: number;
    awayTeamWins: number;
    meetings: number;
    avgTotalPoints: number;
  };
}

export interface PointsOverUnderPayload {
  metric: "points_over_under";
  line: number;
  overRate: number;
  underRate: number;
  label: string;
  homeTeam: { overRate: number; avgTotalPoints: number };
  awayTeam: { overRate: number; avgTotalPoints: number };
  recommendation: "over" | "under" | "neutral";
}

export interface PlayerSpotlightPayload {
  metric: "player_spotlight";
  homePlayer?: {
    fullName: string;
    position?: string;
    teamName: string;
    avgPoints: number;
    avgRebounds: number;
    avgAssists: number;
    lastGames: Array<{ points: number; rebounds: number; assists: number }>;
  };
  awayPlayer?: {
    fullName: string;
    position?: string;
    teamName: string;
    avgPoints: number;
    avgRebounds: number;
    avgAssists: number;
    lastGames: Array<{ points: number; rebounds: number; assists: number }>;
  };
  label: string;
}

export interface GamePreviewPayload {
  metric: "game_preview";
  venueName?: string;
  channel?: string;
  homeRecord: string;
  awayRecord: string;
  homeAvgPoints: number;
  awayAvgPoints: number;
  homeConferenceRank?: number;
  awayConferenceRank?: number;
  label: string;
}
