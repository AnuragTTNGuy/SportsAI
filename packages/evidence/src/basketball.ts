import type { InsightCard, InsightResponse } from "@sports-insights/shared";

type EvidenceRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  computedAt: Date;
};

export function buildBasketballInsightCards(evidenceByType: Map<string, EvidenceRow>): {
  cards: InsightCard[];
  freshness: Record<string, string>;
} {
  const cards: InsightCard[] = [];
  const freshness: Record<string, string> = {};

  const formEvidence = evidenceByType.get("form_guide");
  const h2hEvidence = evidenceByType.get("h2h");
  const pointsOuEvidence = evidenceByType.get("points_over_under");
  const playerSpotlightEvidence = evidenceByType.get("player_spotlight");
  const gamePreviewEvidence = evidenceByType.get("game_preview");

  if (formEvidence) {
    cards.push({
      type: "form_guide",
      title: "Team Form (Last 5)",
      evidenceIds: [formEvidence.id],
      payload: formEvidence.payload,
    });
    freshness.form = formEvidence.computedAt.toISOString();
  }

  if (h2hEvidence) {
    cards.push({
      type: "h2h",
      title: "Head to Head",
      evidenceIds: [h2hEvidence.id],
      payload: h2hEvidence.payload,
    });
    freshness.h2h = h2hEvidence.computedAt.toISOString();
  }

  if (pointsOuEvidence) {
    cards.push({
      type: "points_over_under",
      title: "Points Over / Under",
      evidenceIds: [pointsOuEvidence.id],
      payload: pointsOuEvidence.payload,
    });
    freshness.points_over_under = pointsOuEvidence.computedAt.toISOString();
  }

  if (playerSpotlightEvidence) {
    cards.push({
      type: "player_spotlight",
      title: "Player Spotlight",
      evidenceIds: [playerSpotlightEvidence.id],
      payload: playerSpotlightEvidence.payload,
    });
    freshness.player_spotlight = playerSpotlightEvidence.computedAt.toISOString();
  }

  if (gamePreviewEvidence) {
    cards.push({
      type: "game_preview",
      title: "Game Preview",
      evidenceIds: [gamePreviewEvidence.id],
      payload: gamePreviewEvidence.payload,
    });
    freshness.game_preview = gamePreviewEvidence.computedAt.toISOString();
  }

  return { cards, freshness };
}

export function attachBasketballInsightMetadata(
  response: InsightResponse,
  sport: string,
): InsightResponse {
  return {
    ...response,
    stats: {
      ...response.stats,
      sport,
    },
  };
}
