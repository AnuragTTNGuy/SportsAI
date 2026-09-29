import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchInsights } from "../api/client";
import { InsightCardView } from "../components/InsightCardView";
import type { InsightResponse } from "../types";

export function InsightsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    fetchInsights(eventId)
      .then(setInsights)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <p className="status">
        Loading insights...
        {eventId ? " (first load may take a few seconds while we compute from historical data)" : ""}
      </p>
    );
  }
  if (error) return <p className="status error">Failed to load: {error}</p>;
  if (!insights) return <p className="status error">No insights found</p>;

  const stats = insights.stats as { homeTeam?: { team?: { name?: string } }; awayTeam?: { team?: { name?: string } } };

  return (
    <div>
      <Link className="back-link" to="/">← Competitions</Link>
      <header className="page-header">
        <h1>Match Insights</h1>
        <p className="subtitle">
          {stats.homeTeam?.team?.name ?? "Home"} vs {stats.awayTeam?.team?.name ?? "Away"}
        </p>
      </header>
      <div className="insights-grid">
        {insights.cards.map((card) => (
          <InsightCardView key={card.type} card={card} />
        ))}
      </div>
      {insights.cards.length === 0 && (
        <p className="status">Insights not computed yet for this match.</p>
      )}
    </div>
  );
}
