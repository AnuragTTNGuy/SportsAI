import type { CanonicalTeamStats } from "@sports-insights/normalise";

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

function avgTotalGoals(results: CanonicalTeamStats["recentResults"]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.goalsFor + r.goalsAgainst, 0);
  return Math.round((total / results.length) * 10) / 10;
}

function overRate(results: CanonicalTeamStats["recentResults"], line: number): number {
  if (results.length === 0) return 0;
  const overs = results.filter((r) => r.goalsFor + r.goalsAgainst > line).length;
  return overs / results.length;
}

export function deriveOverUnder25(
  homeStats: CanonicalTeamStats,
  awayStats: CanonicalTeamStats,
  line = 2.5,
): OverUnderPayload {
  const homeOver = overRate(homeStats.recentResults, line);
  const awayOver = overRate(awayStats.recentResults, line);
  const combinedOver = (homeOver + awayOver) / 2;
  const percentage = Math.round(combinedOver * 100);

  let recommendation: OverUnderPayload["recommendation"] = "neutral";
  if (combinedOver >= 0.55) recommendation = "over";
  else if (combinedOver <= 0.45) recommendation = "under";

  return {
    metric: "over_under_2_5",
    line,
    overRate: combinedOver,
    underRate: 1 - combinedOver,
    label: `${percentage}% of recent combined games went Over ${line}`,
    homeTeam: {
      overRate: homeOver,
      avgTotalGoals: avgTotalGoals(homeStats.recentResults),
    },
    awayTeam: {
      overRate: awayOver,
      avgTotalGoals: avgTotalGoals(awayStats.recentResults),
    },
    recommendation,
  };
}
