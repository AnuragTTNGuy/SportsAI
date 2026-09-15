import type {
  AreasCatalogResponse,
  Competition,
  EventSummary,
  InsightResponse,
  SportSlug,
  SportSummary,
  SportsCatalogResponse,
} from "../types";

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL);
const API_KEY = (import.meta.env.VITE_API_KEY || "dev-key-1").trim();

function resolveApiUrl(raw: string | undefined): string {
  const fallback = "http://127.0.0.1:5000";
  const value = (raw || fallback).trim();

  if (!/^https?:\/\//i.test(value)) {
    console.error(`Invalid VITE_API_URL "${value}". Using ${fallback}. Set apps/web/.env and restart Vite.`);
    return fallback;
  }

  return value.replace(/\/$/, "").replace("://localhost", "://127.0.0.1");
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchSports(): Promise<SportSummary[]> {
  const catalog = await apiFetch<SportsCatalogResponse>("/v1/sports");
  return catalog.sports;
}

export async function fetchCompetitions(sport: SportSlug = "football"): Promise<Competition[]> {
  const params = new URLSearchParams({ sport });
  const catalog = await apiFetch<AreasCatalogResponse>(`/v1/areas?${params}`);
  return catalog.areas.flatMap((area) =>
    area.competitions.map((comp) => ({ ...comp, areaName: area.name })),
  );
}

export async function fetchEventsByCompetition(
  competitionName: string,
  sport: SportSlug = "football",
): Promise<EventSummary[]> {
  const params = new URLSearchParams({ competition: competitionName, sport });
  const data = await apiFetch<{ events: EventSummary[] }>(`/v1/events/by-competition?${params}`);
  return data.events;
}

export async function fetchInsights(eventId: string): Promise<InsightResponse> {
  return apiFetch<InsightResponse>(`/v1/events/${eventId}/insights`);
}

export async function fetchCompetitionById(
  competitionId: string,
  sport: SportSlug = "football",
): Promise<Competition | null> {
  const competitions = await fetchCompetitions(sport);
  return competitions.find((c) => c.id === competitionId) ?? null;
}
