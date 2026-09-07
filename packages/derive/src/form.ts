import type { CanonicalTeamStats } from "@sports-insights/normalise";

export interface FormGuidePayload {
  teams: Array<{
    name: string;
    results: Array<"W" | "D" | "L">;
    goalsFor: number;
    goalsAgainst: number;
  }>;
}

export function deriveFormGuide(
  homeStats: CanonicalTeamStats,
  awayStats: CanonicalTeamStats,
): FormGuidePayload {
  return {
    teams: [
      {
        name: homeStats.team.name,
        results: homeStats.recentResults.map((r) => r.result),
        goalsFor: homeStats.goalsScored,
        goalsAgainst: homeStats.goalsConceded,
      },
      {
        name: awayStats.team.name,
        results: awayStats.recentResults.map((r) => r.result),
        goalsFor: awayStats.goalsScored,
        goalsAgainst: awayStats.goalsConceded,
      },
    ],
  };
}
