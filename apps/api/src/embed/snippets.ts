import type { InsightCard, InsightCardType } from "@sports-insights/shared";

const WIDGET_HEIGHT: Record<string, number> = {
  board: 720,
  form_guide: 280,
  h2h: 320,
  trend: 220,
  over_under: 260,
  correct_score: 360,
  half_results: 320,
  points_over_under: 260,
  spread_cover: 480,
  team_total: 380,
  player_spotlight: 300,
  game_preview: 260,
};

export function recommendedWidgetHeight(cardType: InsightCardType | "board"): number {
  return WIDGET_HEIGHT[cardType] ?? 320;
}

export function buildEmbedWidgetPath(
  eventId: string,
  cardType: InsightCardType | "board",
): string {
  if (cardType === "board") {
    return `/embed/v1/events/${eventId}/board`;
  }
  return `/embed/v1/events/${eventId}/widgets/${cardType}`;
}

export function buildEmbedWidgetUrl(
  publicApiUrl: string,
  eventId: string,
  cardType: InsightCardType | "board",
  apiKey: string,
): string {
  const base = publicApiUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ apiKey });
  return `${base}${buildEmbedWidgetPath(eventId, cardType)}?${params.toString()}`;
}

export function buildIframeSnippet(embedUrl: string, height = 320): string {
  return `<iframe
  src="${embedUrl}"
  title="Sports Insights widget"
  width="100%"
  height="${height}"
  style="border:0;border-radius:12px;max-width:100%;"
  loading="lazy"
></iframe>`;
}

export interface IframeSnippetPayload {
  cardType: InsightCardType | "board";
  title: string;
  embedUrl: string;
  iframeHtml: string;
  recommendedHeight: number;
  htmlWidgetPath: string;
}

export function buildSnippetForCard(
  publicApiUrl: string,
  eventId: string,
  card: InsightCard,
  apiKey: string,
): IframeSnippetPayload {
  const embedUrl = buildEmbedWidgetUrl(publicApiUrl, eventId, card.type, apiKey);
  const height = recommendedWidgetHeight(card.type);
  return {
    cardType: card.type,
    title: card.title,
    embedUrl,
    iframeHtml: buildIframeSnippet(embedUrl, height),
    recommendedHeight: height,
    htmlWidgetPath: buildEmbedWidgetPath(eventId, card.type),
  };
}

export function buildBoardSnippet(
  publicApiUrl: string,
  eventId: string,
  title: string,
  apiKey: string,
): IframeSnippetPayload {
  const embedUrl = buildEmbedWidgetUrl(publicApiUrl, eventId, "board", apiKey);
  const height = recommendedWidgetHeight("board");
  return {
    cardType: "board",
    title,
    embedUrl,
    iframeHtml: buildIframeSnippet(embedUrl, height),
    recommendedHeight: height,
    htmlWidgetPath: buildEmbedWidgetPath(eventId, "board"),
  };
}
