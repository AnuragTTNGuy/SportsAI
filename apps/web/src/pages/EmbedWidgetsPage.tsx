import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchInsights } from "../api/client";
import { buildIframeSnippet, buildWidgetEmbedUrl } from "../api/embed";
import type { InsightCard, InsightCardType } from "../types";

const WIDGET_HEIGHT: Partial<Record<InsightCardType | "board", number>> = {
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

function defaultHeight(type: InsightCardType | "board"): number {
  return WIDGET_HEIGHT[type] ?? 320;
}

export function EmbedWidgetsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [cards, setCards] = useState<InsightCard[]>([]);
  const [matchTitle, setMatchTitle] = useState("Match insights");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    fetchInsights(eventId)
      .then((insights) => {
        setCards(insights.cards);
        const stats = insights.stats as {
          homeTeam?: { team?: { name?: string } };
          awayTeam?: { team?: { name?: string } };
        };
        setMatchTitle(
          `${stats.homeTeam?.team?.name ?? "Home"} vs ${stats.awayTeam?.team?.name ?? "Away"}`,
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  const boardUrl = useMemo(
    () => (eventId ? buildWidgetEmbedUrl(eventId, "board") : ""),
    [eventId],
  );

  const copySnippet = async (key: string, snippet: string) => {
    await navigator.clipboard.writeText(snippet);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) return <p className="status">Loading widget catalog...</p>;
  if (error) return <p className="status error">Failed to load: {error}</p>;
  if (!eventId) return <p className="status error">Missing event id</p>;

  return (
    <div>
      <Link className="back-link" to={`/matches/${eventId}/insights`}>← API insights view</Link>
      <header className="page-header">
        <h1>Embed widgets</h1>
        <p className="subtitle">
          {matchTitle} — each card is served as an iframe from the API (works in any site or stack).
        </p>
      </header>

      <section className="section">
        <h2 className="section-title">Full board</h2>
        <p className="subtitle">Single iframe with all insight cards.</p>
        <div className="embed-preview">
          <iframe
            src={boardUrl}
            title="All insights"
            className="embed-frame embed-frame--board"
            loading="lazy"
          />
        </div>
        <button
          type="button"
          className="embed-copy-btn"
          onClick={() => copySnippet("board", buildIframeSnippet(boardUrl, defaultHeight("board")))}
        >
          {copiedKey === "board" ? "Copied" : "Copy iframe code"}
        </button>
      </section>

      {cards.length === 0 && (
        <p className="status">No insight cards yet. Open the API insights view first to trigger compute.</p>
      )}

      {cards.map((card) => {
        const url = buildWidgetEmbedUrl(eventId, card.type);
        const height = defaultHeight(card.type);
        const snippet = buildIframeSnippet(url, height);
        return (
          <section key={card.type} className="section">
            <h2 className="section-title">{card.title}</h2>
            <p className="card-meta">Widget type: <code>{card.type}</code></p>
            <div className="embed-preview">
              <iframe
                src={url}
                title={card.title}
                className="embed-frame"
                style={{ minHeight: height }}
                loading="lazy"
              />
            </div>
            <button
              type="button"
              className="embed-copy-btn"
              onClick={() => copySnippet(card.type, snippet)}
            >
              {copiedKey === card.type ? "Copied" : "Copy iframe code"}
            </button>
          </section>
        );
      })}
    </div>
  );
}
