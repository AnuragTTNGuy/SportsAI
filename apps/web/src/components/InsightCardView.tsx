import type { FormGuidePayload, H2HPayload, InsightCard, TrendPayload } from "../types";

function FormGuideCard({ payload }: { payload: FormGuidePayload }) {
  return (
    <div className="insight-card">
      {payload.teams.map((team) => (
        <div key={team.name} className="form-row">
          <strong>{team.name}</strong>
          <div className="form-results">
            {team.results.map((result, index) => (
              <span key={`${team.name}-${index}`} className={`result result-${result.toLowerCase()}`}>
                {result}
              </span>
            ))}
          </div>
          <span className="card-meta">
            {team.goalsFor} scored · {team.goalsAgainst} conceded
          </span>
        </div>
      ))}
    </div>
  );
}

function H2HCard({ payload }: { payload: H2HPayload }) {
  return (
    <div className="insight-card">
      <p>{payload.summary}</p>
      <div className="h2h-stats">
        <span>W {payload.stats.homeTeamWins}</span>
        <span>D {payload.stats.draws}</span>
        <span>L {payload.stats.awayTeamWins}</span>
      </div>
    </div>
  );
}

function TrendCard({ payload }: { payload: TrendPayload }) {
  return (
    <div className="insight-card">
      <div className="trend-value">{Math.round(payload.value * 100)}%</div>
      <p>{payload.label}</p>
    </div>
  );
}

interface Props {
  card: InsightCard;
}

export function InsightCardView({ card }: Props) {
  const typeClass = {
    form_guide: "insight-section--form",
    h2h: "insight-section--h2h",
    trend: "insight-section--trend",
  }[card.type];

  return (
    <section className={`card insight-section ${typeClass}`}>
      <h3>{card.title}</h3>
      {card.type === "form_guide" && (
        <FormGuideCard payload={card.payload as unknown as FormGuidePayload} />
      )}
      {card.type === "h2h" && <H2HCard payload={card.payload as unknown as H2HPayload} />}
      {card.type === "trend" && <TrendCard payload={card.payload as unknown as TrendPayload} />}
    </section>
  );
}
