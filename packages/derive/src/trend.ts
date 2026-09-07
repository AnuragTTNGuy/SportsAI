import type { CanonicalTeamStats } from "@sports-insights/normalise";

export interface TrendPayload {
  value: number;
  label: string;
  metric: string;
}

export function deriveBothTeamsToScoreTrend(
  homeStats: CanonicalTeamStats,
  awayStats: CanonicalTeamStats,
): TrendPayload {
  const combinedRate = (homeStats.bothTeamsScoredRate + awayStats.bothTeamsScoredRate) / 2;
  const percentage = Math.round(combinedRate * 100);

  return {
    metric: "both_teams_to_score",
    value: combinedRate,
    label: `${percentage}% in recent combined games`,
  };
}
