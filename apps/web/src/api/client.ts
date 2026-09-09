import type { AreasCatalogResponse, Competition, EventSummary, InsightResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "dev-key-1";

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

export async function fetchCompetitions(): Promise<Competition[]> {
  const catalog = await apiFetch<AreasCatalogResponse>("/v1/areas");
  return catalog.areas.flatMap((area) =>
    area.competitions.map((comp) => ({ ...comp, areaName: area.name })),
  );
}

export async function fetchEventsByCompetition(competitionName: string): Promise<EventSummary[]> {
  const params = new URLSearchParams({ competition: competitionName, sport: "football" });
  const data = await apiFetch<{ events: EventSummary[] }>(`/v1/events/by-competition?${params}`);
  return data.events;
}

export async function fetchInsights(eventId: string): Promise<InsightResponse> {
  return apiFetch<InsightResponse>(`/v1/events/${eventId}/insights`);
}

export async function fetchCompetitionById(competitionId: string): Promise<Competition | null> {
  const competitions = await fetchCompetitions();
  return competitions.find((c) => c.id === competitionId) ?? null;
}
