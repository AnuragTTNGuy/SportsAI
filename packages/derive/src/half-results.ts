import type { CanonicalTeamStats, HeadToHeadStats } from "@sports-insights/normalise";

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

function htResult(goalsFor: number, goalsAgainst: number): "W" | "D" | "L" {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

function breakdownFromResults(results: Array<"W" | "D" | "L">): HalfResultBreakdown {
  const wins = results.filter((r) => r === "W").length;
  const draws = results.filter((r) => r === "D").length;
  const losses = results.filter((r) => r === "L").length;
  const total = results.length || 1;

  return {
    wins,
    draws,
    losses,
    winRate: Math.round((wins / total) * 1000) / 1000,
    drawRate: Math.round((draws / total) * 1000) / 1000,
    lossRate: Math.round((losses / total) * 1000) / 1000,
  };
}

function teamHtResults(stats: CanonicalTeamStats): Array<"W" | "D" | "L"> {
  return stats.recentResults
    .filter((r) => r.goalsForHt != null && r.goalsAgainstHt != null)
    .map((r) => htResult(r.goalsForHt!, r.goalsAgainstHt!));
}

export function deriveHalfResults(
  homeStats: CanonicalTeamStats,
  awayStats: CanonicalTeamStats,
  h2h: HeadToHeadStats,
  homeTeamName: string,
): HalfResultsPayload {
  const homeHt = breakdownFromResults(teamHtResults(homeStats));
  const awayHt = breakdownFromResults(teamHtResults(awayStats));

  let htHomeWins = 0;
  let htDraws = 0;
  let htAwayWins = 0;

  for (const meeting of h2h.meetings) {
    if (meeting.homeScoreHt == null || meeting.awayScoreHt == null) continue;

    const homeSideIsNamedTeam = meeting.homeTeam === homeTeamName;
    const homeHtGoals = homeSideIsNamedTeam ? meeting.homeScoreHt : meeting.awayScoreHt;
    const awayHtGoals = homeSideIsNamedTeam ? meeting.awayScoreHt : meeting.homeScoreHt;

    if (homeHtGoals > awayHtGoals) htHomeWins++;
    else if (homeHtGoals < awayHtGoals) htAwayWins++;
    else htDraws++;
  }

  const h2hMeetings = htHomeWins + htDraws + htAwayWins;
  const leadingTeam = homeHt.winRate >= awayHt.winRate ? homeStats.team.name : awayStats.team.name;
  const leadingRate = Math.round(Math.max(homeHt.winRate, awayHt.winRate) * 100);

  return {
    metric: "half_results",
    homeTeam: homeHt,
    awayTeam: awayHt,
    h2h: {
      homeWins: htHomeWins,
      draws: htDraws,
      awayWins: htAwayWins,
      meetings: h2hMeetings,
    },
    label: h2hMeetings
      ? `${leadingTeam} led at half-time in ${leadingRate}% of recent games`
      : `${leadingTeam} led at half-time in ${leadingRate}% of recent games (no H2H half-time data)`,
  };
}
