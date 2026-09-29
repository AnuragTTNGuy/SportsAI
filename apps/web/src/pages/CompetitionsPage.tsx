import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCompetitions } from "../api/client";
import { CompetitionCard } from "../components/CompetitionCard";
import type { Competition, SportSlug } from "../types";

const SPORT_LABELS: Record<SportSlug, string> = {
  football: "Football",
  basketball: "Basketball",
};

export function CompetitionsPage() {
  const { sport = "football" } = useParams<{ sport: SportSlug }>();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validSport: SportSlug = sport === "basketball" ? "basketball" : "football";

  useEffect(() => {
    setLoading(true);
    fetchCompetitions(validSport)
      .then(setCompetitions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [validSport]);

  if (sport !== "football" && sport !== "basketball") {
    return <p className="status error">Unknown sport: {sport}</p>;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return competitions;
    return competitions.filter(
      (c) => c.name.toLowerCase().includes(q) || c.areaName.toLowerCase().includes(q),
    );
  }, [competitions, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Competition[]>();
    for (const comp of filtered) {
      const list = map.get(comp.areaName) ?? [];
      list.push(comp);
      map.set(comp.areaName, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (loading) return <p className="status">Loading competitions...</p>;
  if (error) return <p className="status error">Failed to load: {error}</p>;

  return (
    <div>
      <Link className="back-link" to="/">← All Sports</Link>
      <header className="page-header">
        <span className="page-badge">{SPORT_LABELS[validSport] ?? sport}</span>
        <h1>{SPORT_LABELS[validSport] ?? sport} Leagues</h1>
        <p className="subtitle">Pick a league to browse matches and insights</p>
        <input
          className="search-input"
          placeholder="Search leagues or regions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>
      {grouped.map(([areaName, comps]) => (
        <section key={areaName} className="section">
          <h2 className="section-title">{areaName}</h2>
          <div className="grid">
            {comps.map((comp) => (
              <CompetitionCard key={comp.id} competition={comp} sport={validSport} />
            ))}
          </div>
        </section>
      ))}
      {filtered.length === 0 && (
        <p className="status">
          No leagues found for {SPORT_LABELS[validSport] ?? sport}.
          {validSport === "basketball" && (
            <> Run <code>npm run ingest:nba</code> to load NBA matches from stats.nba.com.</>
          )}
        </p>
      )}
    </div>
  );
}
