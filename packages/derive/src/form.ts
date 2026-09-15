import type { CanonicalTeamStats } from "@sports-insights/normalise";

export const RECENT_FORM_MATCHES = 5;

export interface FormGuidePayload {
  teams: Array<{
    name: string;
    results: Array<"W" | "D" | "L">;
    goalsFor: number;
    goalsAgainst: number;
  }>;
  matchCount: number;
}

function buildTeamForm(
  stats: CanonicalTeamStats,
  lastN: number,
): FormGuidePayload["teams"][number] {
  const recent = stats.recentResults.slice(0, lastN);

  return {
    name: stats.team.name,
    results: recent.map((r) => r.result),
    goalsFor: recent.reduce((sum, r) => sum + r.goalsFor, 0),
    goalsAgainst: recent.reduce((sum, r) => sum + r.goalsAgainst, 0),
  };
}

export function deriveFormGuide(
  homeStats: CanonicalTeamStats,
  awayStats: CanonicalTeamStats,
  lastN = RECENT_FORM_MATCHES,
): FormGuidePayload {
  return {
    matchCount: lastN,
    teams: [buildTeamForm(homeStats, lastN), buildTeamForm(awayStats, lastN)],
  };
}
