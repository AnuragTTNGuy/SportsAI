import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSports } from "../api/client";
import type { SportSummary } from "../types";

const SPORT_ICONS: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
};

export function SportsHomePage() {
  const [sports, setSports] = useState<SportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSports()
      .then(setSports)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="status">Loading sports...</p>;
  if (error) return <p className="status error">Failed to load: {error}</p>;

  return (
    <div>
      <header className="page-header">
        <span className="page-badge">Multi-sport platform</span>
        <h1>Choose a Sport</h1>
        <p className="subtitle">Browse leagues, matches, and evidence-backed insights</p>
      </header>
      <div className="grid sport-grid">
        {sports.map((sport) => (
          <Link key={sport.slug} to={`/${sport.slug}`} className="card sport-card">
            <div className="sport-card-icon">{SPORT_ICONS[sport.slug] ?? "🏟️"}</div>
            <h2>{sport.name}</h2>
            <p>{sport.description}</p>
            <span className="card-meta">
              {sport.competitionCount ?? 0} league{(sport.competitionCount ?? 0) === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
