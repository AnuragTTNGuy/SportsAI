import type { CanonicalTeamStats, HeadToHeadStats } from "@sports-insights/normalise";

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

function avgGoalsPerGame(results: CanonicalTeamStats["recentResults"], field: "for" | "against"): number {
  if (results.length === 0) return field === "for" ? 1.2 : 1.0;
  const total = results.reduce(
    (sum, r) => sum + (field === "for" ? r.goalsFor : r.goalsAgainst),
    0,
  );
  return total / results.length;
}

function addScore(
  scores: Map<string, { weight: number; sources: Set<CorrectScorePrediction["source"]> }>,
  score: string,
  weight: number,
  source: CorrectScorePrediction["source"],
) {
  const existing = scores.get(score) ?? { weight: 0, sources: new Set<CorrectScorePrediction["source"]>() };
  existing.weight += weight;
  existing.sources.add(source);
  scores.set(score, existing);
}

export function deriveCorrectScore(
  homeStats: CanonicalTeamStats,
  awayStats: CanonicalTeamStats,
  h2h: HeadToHeadStats,
): CorrectScorePayload {
  const scores = new Map<string, { weight: number; sources: Set<CorrectScorePrediction["source"]> }>();

  for (const meeting of h2h.meetings) {
    addScore(scores, `${meeting.homeScore}-${meeting.awayScore}`, 2, "h2h");
  }

  const homeAvgFor = avgGoalsPerGame(homeStats.recentResults, "for");
  const awayAvgFor = avgGoalsPerGame(awayStats.recentResults, "for");
  const baseHome = Math.max(0, Math.round(homeAvgFor));
  const baseAway = Math.max(0, Math.round(awayAvgFor));

  const formVariations = [
    [baseHome, baseAway],
    [baseHome + 1, baseAway],
    [baseHome, baseAway + 1],
    [baseHome + 1, baseAway + 1],
    [Math.max(0, baseHome - 1), baseAway],
    [baseHome, Math.max(0, baseAway - 1)],
  ];

  for (const [home, away] of formVariations) {
    addScore(scores, `${home}-${away}`, 1.5, "form");
  }

  const totalWeight = [...scores.values()].reduce((sum, entry) => sum + entry.weight, 0);

  const predictions: CorrectScorePrediction[] = [...scores.entries()]
    .map(([score, entry]) => ({
      score,
      probability: totalWeight > 0 ? Math.round((entry.weight / totalWeight) * 1000) / 1000 : 0,
      source: entry.sources.size > 1 ? "combined" : [...entry.sources][0]!,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const topScore = predictions[0]?.score ?? `${baseHome}-${baseAway}`;
  const topPct = Math.round((predictions[0]?.probability ?? 0) * 100);

  return {
    metric: "correct_score",
    predictions,
    label: predictions.length
      ? `Most likely correct score: ${topScore} (${topPct}% based on form & H2H)`
      : "Insufficient data for correct score prediction",
  };
}
