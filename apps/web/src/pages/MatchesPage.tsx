import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCompetitionById, fetchEventsByCompetition } from "../api/client";
import { MatchCard } from "../components/MatchCard";
import type { Competition, EventSummary, SportSlug } from "../types";

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDayHeading(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function MatchesPage() {
  const { sport = "football", competitionId } = useParams<{ sport: SportSlug; competitionId: string }>();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isBasketball = sport === "basketball";

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

  const eventsByDay = useMemo(() => {
    const groups = new Map<string, EventSummary[]>();
    for (const event of events) {
      const key = dayKey(event.scheduledAt);
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [events]);

  if (loading) return <p className="status">Loading matches...</p>;
  if (error) return <p className="status error">Failed to load: {error}</p>;
  if (!competition) return <p className="status error">Competition not found</p>;

  return (
    <div>
      <Link className="back-link" to={`/${sport}`}>← {isBasketball ? "Basketball" : "Football"} leagues</Link>
      <header className="page-header">
        <div className="page-badge">{competition.areaName}</div>
        <h1>{competition.name}</h1>
        <p className="subtitle">
          Upcoming matches — insights use recent form, H2H, and trends from older games
        </p>
      </header>
      {events.length === 0 ? (
        <p className="status">
          {isBasketball ? (
            <>
              No upcoming NBA games yet. Run <code>npm run ingest:nba</code>.
            </>
          ) : (
            <>
              No upcoming matches yet. Run <code>npm run ingest:schedules</code> (SportsDataIO)
              or <code>npm run seed</code> for demo fixtures.
            </>
          )}
        </p>
      ) : (
        <div className="stack">
          {eventsByDay.map(([day, dayEvents]) => (
            <section key={day} className="match-day-group">
              <h2 className="match-day-heading">{formatDayHeading(dayEvents[0]!.scheduledAt)}</h2>
              <div className="stack">
                {dayEvents.map((event) => (
                  <MatchCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
