import { Link } from "react-router-dom";
import type { EventSummary } from "../types";

interface Props {
  event: EventSummary;
}

function formatMatchTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function MatchCard({ event }: Props) {
  return (
    <Link className="card card-link match-card" to={`/matches/${event.id}/insights`}>
      <div className="match-teams">
        <span>{event.homeTeamName}</span>
        <span className="match-vs">vs</span>
        <span>{event.awayTeamName}</span>
      </div>
      <div className="card-meta">
        {formatMatchTime(event.scheduledAt)} · {event.status}
      </div>
    </Link>
  );
}
