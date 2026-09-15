import type {
  BasketballHeadToHeadStats,
  BasketballPlayerSpotlight,
  BasketballTeamStats,
  NbaGame,
  NbaStanding,
} from "@sports-insights/normalise";

export const RECENT_BASKETBALL_FORM_MATCHES = 5;
export const DEFAULT_NBA_TOTAL_LINE = 220.5;

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
  homePlayer?: BasketballPlayerSpotlight;
  awayPlayer?: BasketballPlayerSpotlight;
  label: string;
}

export interface GamePreviewPayload {
  metric: "game_preview";
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

function buildTeamForm(stats: BasketballTeamStats, lastN: number) {
  const recent = stats.recentResults.slice(0, lastN);
  const pointsFor = recent.reduce((sum: number, r) => sum + r.pointsFor, 0);
  const pointsAgainst = recent.reduce((sum: number, r) => sum + r.pointsAgainst, 0);
  const count = recent.length || 1;

  return {
    name: stats.team.name,
    results: recent.map((r) => r.result),
    pointsFor,
    pointsAgainst,
    avgPointsFor: Math.round((pointsFor / count) * 10) / 10,
    avgPointsAgainst: Math.round((pointsAgainst / count) * 10) / 10,
  };
}

export function deriveBasketballFormGuide(
  homeStats: BasketballTeamStats,
  awayStats: BasketballTeamStats,
  lastN = RECENT_BASKETBALL_FORM_MATCHES,
): BasketballFormGuidePayload {
  return {
    matchCount: lastN,
    teams: [buildTeamForm(homeStats, lastN), buildTeamForm(awayStats, lastN)],
  };
}

export function deriveBasketballH2H(
  homeTeamName: string,
  awayTeamName: string,
  h2h: BasketballHeadToHeadStats,
): BasketballH2HPayload {
  const meetings = h2h.meetings.length;
  const summary = meetings
    ? `${homeTeamName} ${h2h.homeTeamWins}-${h2h.awayTeamWins} vs ${awayTeamName} (${meetings} meetings, avg ${h2h.avgTotalPoints} pts)`
    : `No recent meetings between ${homeTeamName} and ${awayTeamName}`;

  return {
    summary,
    stats: {
      homeTeamWins: h2h.homeTeamWins,
      awayTeamWins: h2h.awayTeamWins,
      meetings,
      avgTotalPoints: h2h.avgTotalPoints,
    },
  };
}

function overRate(results: BasketballTeamStats["recentResults"], line: number): number {
  if (results.length === 0) return 0;
  const overs = results.filter((r) => r.pointsFor + r.pointsAgainst > line).length;
  return overs / results.length;
}

function avgTotalPoints(results: BasketballTeamStats["recentResults"]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum: number, r) => sum + r.pointsFor + r.pointsAgainst, 0);
  return Math.round((total / results.length) * 10) / 10;
}

export function derivePointsOverUnder(
  homeStats: BasketballTeamStats,
  awayStats: BasketballTeamStats,
  line = DEFAULT_NBA_TOTAL_LINE,
): PointsOverUnderPayload {
  const homeOver = overRate(homeStats.recentResults, line);
  const awayOver = overRate(awayStats.recentResults, line);
  const combinedOver = (homeOver + awayOver) / 2;
  const percentage = Math.round(combinedOver * 100);

  let recommendation: PointsOverUnderPayload["recommendation"] = "neutral";
  if (combinedOver >= 0.55) recommendation = "over";
  else if (combinedOver <= 0.45) recommendation = "under";

  return {
    metric: "points_over_under",
    line,
    overRate: combinedOver,
    underRate: 1 - combinedOver,
    label: `${percentage}% of recent combined games went Over ${line} points`,
    homeTeam: {
      overRate: homeOver,
      avgTotalPoints: avgTotalPoints(homeStats.recentResults),
    },
    awayTeam: {
      overRate: awayOver,
      avgTotalPoints: avgTotalPoints(awayStats.recentResults),
    },
    recommendation,
  };
}

export function derivePlayerSpotlight(
  homeSpotlight: BasketballPlayerSpotlight | undefined,
  awaySpotlight: BasketballPlayerSpotlight | undefined,
): PlayerSpotlightPayload {
  const top = homeSpotlight && awaySpotlight
    ? (homeSpotlight.avgPoints >= awaySpotlight.avgPoints ? homeSpotlight : awaySpotlight)
    : homeSpotlight ?? awaySpotlight;

  return {
    metric: "player_spotlight",
    homePlayer: homeSpotlight,
    awayPlayer: awaySpotlight,
    label: top
      ? `${top.fullName} averaging ${top.avgPoints} PPG over last ${top.lastGames.length} games`
      : "Player spotlight unavailable",
  };
}

export function deriveGamePreview(
  game: NbaGame | undefined,
  homeStats: BasketballTeamStats,
  awayStats: BasketballTeamStats,
  homeStanding?: NbaStanding,
  awayStanding?: NbaStanding,
): GamePreviewPayload {
  const homeRecord = homeStanding ? `${homeStanding.wins}-${homeStanding.losses}` : "N/A";
  const awayRecord = awayStanding ? `${awayStanding.wins}-${awayStanding.losses}` : "N/A";

  return {
    metric: "game_preview",
    venueName: game?.venueName,
    venueCity: undefined,
    channel: game?.channel,
    homeRecord,
    awayRecord,
    homeAvgPoints: homeStats.avgPointsFor,
    awayAvgPoints: awayStats.avgPointsFor,
    homeConferenceRank: homeStanding?.conferenceRank,
    awayConferenceRank: awayStanding?.conferenceRank,
    label: `${homeStats.team.name} (${homeRecord}) vs ${awayStats.team.name} (${awayRecord})`,
  };
}
