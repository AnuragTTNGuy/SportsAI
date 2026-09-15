import { Link } from "react-router-dom";
import type { Competition, SportSlug } from "../types";

export function CompetitionCard({
  competition,
  sport = "football",
}: {
  competition: Competition;
  sport?: SportSlug;
}) {
  return (
    <Link className="card card-link competition-card-accent" to={`/${sport}/competitions/${competition.id}/matches`}>
      <div className="card-meta">{competition.areaName}</div>
      <h2>{competition.name}</h2>
      <div className="card-tags">
        {competition.key && <span className="tag">{competition.key}</span>}
        {competition.gender && <span className="tag">{competition.gender}</span>}
      </div>
    </Link>
  );
}
