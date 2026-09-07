import type { evidenceRecords } from "@sports-insights/db";

type EvidenceRow = typeof evidenceRecords.$inferSelect;

export function isEvidenceValid(record: EvidenceRow, now = new Date()): boolean {
  return record.expiresAt > now;
}

export function filterValidEvidence(records: EvidenceRow[], now = new Date()): EvidenceRow[] {
  return records.filter((record) => isEvidenceValid(record, now));
}

export function assertEvidenceMatchRate(
  requestedTypes: string[],
  validRecords: EvidenceRow[],
  minRate = 0.99,
): boolean {
  if (requestedTypes.length === 0) return true;
  const foundTypes = new Set(validRecords.map((r) => r.type));
  const matched = requestedTypes.filter((t) => foundTypes.has(t)).length;
  return matched / requestedTypes.length >= minRate;
}
