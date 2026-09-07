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
  stats: 30,
  ladder: 60,
  lineup: 15,
};

export function getEvidenceTtl(type: string): number {
  return EVIDENCE_TTL_MINUTES[type] ?? 60;
}
