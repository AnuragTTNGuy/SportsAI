export interface Competition {
  id: string;
  providerId: string;
  name: string;
  key?: string;
  gender?: string;
  type?: string;
  format?: string;
  areaName: string;
}

export interface EventSummary {
  id: string;
  competitionId: string;
  competitionName?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: string;
  status: string;
  sport: string;
}

export interface InsightCard {
  type: "form_guide" | "h2h" | "trend";
  title: string;
  evidenceIds: string[];
  payload: Record<string, unknown>;
}

export interface InsightResponse {
  eventId: string;
  generatedAt: string;
  freshness: Record<string, string>;
  cards: InsightCard[];
  stats: Record<string, unknown>;
  ladder: Record<string, unknown>;
  lineup: Record<string, unknown>;
}

export interface AreasCatalogResponse {
  generatedAt: string;
  areas: Array<{
    id: string;
    providerId: string;
    countryCode: string;
    name: string;
    competitions: Array<{
      id: string;
      providerId: string;
      name: string;
      key?: string;
      gender?: string;
      type?: string;
      format?: string;
    }>;
  }>;
}

export interface FormGuidePayload {
  teams: Array<{
    name: string;
    results: Array<"W" | "D" | "L">;
    goalsFor: number;
    goalsAgainst: number;
  }>;
}

export interface H2HPayload {
  summary: string;
  stats: { homeTeamWins: number; awayTeamWins: number; draws: number };
}

export interface TrendPayload {
  metric: string;
  value: number;
  label: string;
}
