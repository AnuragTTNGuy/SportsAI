export interface NewEvidenceInput {
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
  sourceStatIds?: string[];
  ttlMinutes?: number;
}

export function computeExpiryDate(ttlMinutes: number): Date {
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

export const EVIDENCE_TTL_MINUTES: Record<string, number> = {
  form_guide: 60,
  h2h: 120,
  trend: 60,
  over_under: 60,
  correct_score: 60,
  half_results: 60,
  points_over_under: 60,
  spread_cover: 60,
  team_total: 60,
  player_spotlight: 60,
  game_preview: 120,
  stats: 30,
  ladder: 60,
  lineup: 15,
};

export function getEvidenceTtl(type: string): number {
  return EVIDENCE_TTL_MINUTES[type] ?? 60;
}
