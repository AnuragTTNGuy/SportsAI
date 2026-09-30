import type { InsightCardType } from "../types";

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL);
const API_KEY = (import.meta.env.VITE_API_KEY || "dev-key-1").trim();

function resolveApiUrl(raw: string | undefined): string {
  const fallback = "http://127.0.0.1:5000";
  const value = (raw || fallback).trim();
  if (!/^https?:\/\//i.test(value)) return fallback;
  return value.replace(/\/$/, "").replace("://localhost", "://127.0.0.1");
}

export function getEmbedApiBaseUrl(): string {
  return API_URL;
}

export function buildWidgetEmbedUrl(eventId: string, cardType: InsightCardType | "board"): string {
  const path = cardType === "board"
    ? `/embed/v1/events/${eventId}/board`
    : `/embed/v1/events/${eventId}/widgets/${cardType}`;
  const params = new URLSearchParams({ apiKey: API_KEY });
  return `${API_URL}${path}?${params.toString()}`;
}

export function buildIframeSnippet(embedUrl: string, height = 360): string {
  return `<iframe
  src="${embedUrl}"
  title="Sports Insights widget"
  width="100%"
  height="${height}"
  style="border:0;border-radius:12px;max-width:100%;"
  loading="lazy"
></iframe>`;
}
