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

export const DEFAULT_SPREAD_LINES = [3.5, 5.5, 7.5] as const;
export const DEFAULT_TEAM_TOTAL_LINE = 112.5;

export interface SpreadLineCover {
  line: number;
  coverRate: number;
  coverCount: number;
  sampleSize: number;
}

export interface SpreadCoverTeam {
  name: string;
  avgMargin: number;
  covers: SpreadLineCover[];
}

export interface SpreadCoverPayload {
  metric: "spread_cover";
  lines: number[];
  homeTeam: SpreadCoverTeam;
  awayTeam: SpreadCoverTeam;
  h2h: {
    meetings: number;
    avgMargin: number;
    label: string;
  };
  label: string;
}

export interface TeamTotalSide {
  name: string;
  overRate: number;
  underRate: number;
  avgPointsFor: number;
  recommendation: "over" | "under" | "neutral";
}

export interface TeamTotalPayload {
  metric: "team_total";
  line: number;
  homeTeam: TeamTotalSide;
  awayTeam: TeamTotalSide;
  label: string;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function avgMargin(results: BasketballTeamStats["recentResults"]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + (r.pointsFor - r.pointsAgainst), 0);
  return round1(total / results.length);
}

/** Cover rate as a favorite giving `line` points (margin > line). */
function coverRateAtLine(
  results: BasketballTeamStats["recentResults"],
  line: number,
): SpreadLineCover {
  const sampleSize = results.length;
  if (sampleSize === 0) {
    return { line, coverRate: 0, coverCount: 0, sampleSize: 0 };
  }
  const coverCount = results.filter((r) => r.pointsFor - r.pointsAgainst > line).length;
  return {
    line,
    coverRate: coverCount / sampleSize,
    coverCount,
    sampleSize,
  };
}

function buildSpreadTeam(
  stats: BasketballTeamStats,
  lines: readonly number[],
): SpreadCoverTeam {
  return {
    name: stats.team.name,
    avgMargin: avgMargin(stats.recentResults),
    covers: lines.map((line) => coverRateAtLine(stats.recentResults, line)),
  };
}

function h2hAvgMarginForHome(
  homeTeamName: string,
  h2h: BasketballHeadToHeadStats,
): number {
  if (h2h.meetings.length === 0) return 0;
  const total = h2h.meetings.reduce((sum, meeting) => {
    const margin = meeting.homeTeam === homeTeamName
      ? meeting.homeScore - meeting.awayScore
      : meeting.awayScore - meeting.homeScore;
    return sum + margin;
  }, 0);
  return round1(total / h2h.meetings.length);
}

export function deriveSpreadCover(
  homeStats: BasketballTeamStats,
  awayStats: BasketballTeamStats,
  h2h: BasketballHeadToHeadStats,
  lines: readonly number[] = DEFAULT_SPREAD_LINES,
): SpreadCoverPayload {
  const homeTeam = buildSpreadTeam(homeStats, lines);
  const awayTeam = buildSpreadTeam(awayStats, lines);
  const primary = lines[1] ?? lines[0] ?? 5.5;
  const homePrimary = homeTeam.covers.find((c) => c.line === primary)?.coverRate ?? 0;
  const awayPrimary = awayTeam.covers.find((c) => c.line === primary)?.coverRate ?? 0;
  const h2hMargin = h2hAvgMarginForHome(homeStats.team.name, h2h);
  const meetings = h2h.meetings.length;

  return {
    metric: "spread_cover",
    lines: [...lines],
    homeTeam,
    awayTeam,
    h2h: {
      meetings,
      avgMargin: h2hMargin,
      label: meetings
        ? `H2H avg margin (home perspective): ${h2hMargin > 0 ? "+" : ""}${h2hMargin}`
        : "No H2H meetings for margin",
    },
    label:
      `${homeTeam.name} covers -${primary} in ${Math.round(homePrimary * 100)}% of recent games · `
      + `${awayTeam.name} ${Math.round(awayPrimary * 100)}%`,
  };
}

function teamPointsOverRate(
  results: BasketballTeamStats["recentResults"],
  line: number,
): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.pointsFor > line).length / results.length;
}

function avgPointsFor(results: BasketballTeamStats["recentResults"]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.pointsFor, 0);
  return round1(total / results.length);
}

function teamTotalRecommendation(overRateValue: number): TeamTotalSide["recommendation"] {
  if (overRateValue >= 0.55) return "over";
  if (overRateValue <= 0.45) return "under";
  return "neutral";
}

function buildTeamTotalSide(
  stats: BasketballTeamStats,
  line: number,
): TeamTotalSide {
  const over = teamPointsOverRate(stats.recentResults, line);
  return {
    name: stats.team.name,
    overRate: over,
    underRate: 1 - over,
    avgPointsFor: avgPointsFor(stats.recentResults),
    recommendation: teamTotalRecommendation(over),
  };
}

export function deriveTeamTotal(
  homeStats: BasketballTeamStats,
  awayStats: BasketballTeamStats,
  line = DEFAULT_TEAM_TOTAL_LINE,
): TeamTotalPayload {
  const homeTeam = buildTeamTotalSide(homeStats, line);
  const awayTeam = buildTeamTotalSide(awayStats, line);

  return {
    metric: "team_total",
    line,
    homeTeam,
    awayTeam,
    label:
      `Team totals vs ${line}: ${homeTeam.name} avg ${homeTeam.avgPointsFor} · `
      + `${awayTeam.name} avg ${awayTeam.avgPointsFor}`,
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
