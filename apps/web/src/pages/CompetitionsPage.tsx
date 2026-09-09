import { useEffect, useMemo, useState } from "react";
import { fetchCompetitions } from "../api/client";
import { CompetitionCard } from "../components/CompetitionCard";
import type { Competition } from "../types";

export function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompetitions()
      .then(setCompetitions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
      <header className="page-header">
        <h1>Competitions</h1>
        <p className="subtitle">Pick a competition to browse matches and insights</p>
        <input
          className="search-input"
          placeholder="Search competitions or regions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>
      {grouped.map(([areaName, comps]) => (
        <section key={areaName} className="section">
          <h2 className="section-title">{areaName}</h2>
          <div className="grid">
            {comps.map((comp) => (
              <CompetitionCard key={comp.id} competition={comp} />
            ))}
          </div>
        </section>
      ))}
      {filtered.length === 0 && <p className="status">No competitions found.</p>}
    </div>
  );
}
