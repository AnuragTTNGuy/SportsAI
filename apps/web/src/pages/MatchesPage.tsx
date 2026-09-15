import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCompetitionById, fetchEventsByCompetition } from "../api/client";
import { MatchCard } from "../components/MatchCard";
import type { Competition, EventSummary, SportSlug } from "../types";

export function MatchesPage() {
  const { sport = "football", competitionId } = useParams<{ sport: SportSlug; competitionId: string }>();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!competitionId) return;
    setLoading(true);
    setError(null);

    fetchCompetitionById(competitionId, sport)
      .then(async (comp) => {
        if (!comp) throw new Error("Competition not found");
        setCompetition(comp);
        const list = await fetchEventsByCompetition(comp.name, sport);
        setEvents(list);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [competitionId, sport]);

  if (loading) return <p className="status">Loading matches...</p>;
  if (error) return <p className="status error">Failed to load: {error}</p>;
  if (!competition) return <p className="status error">Competition not found</p>;

  return (
    <div>
      <Link className="back-link" to={`/${sport}`}>← {sport === "basketball" ? "Basketball" : "Football"} leagues</Link>
      <header className="page-header">
        <div className="page-badge">{competition.areaName}</div>
        <h1>{competition.name}</h1>
        <p className="subtitle">Select a match to view insights</p>
      </header>
      {events.length === 0 ? (
        <p className="status">
          No matches in the database for this league yet. Run ingest jobs or `npm run seed:basketball`.
        </p>
      ) : (
        <div className="stack">
          {events.map((event) => (
            <MatchCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
