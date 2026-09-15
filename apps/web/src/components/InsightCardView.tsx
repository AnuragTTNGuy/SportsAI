import type {
  BasketballFormGuidePayload,
  BasketballH2HPayload,
  CorrectScorePayload,
  FormGuidePayload,
  GamePreviewPayload,
  H2HPayload,
  HalfResultsPayload,
  InsightCard,
  OverUnderPayload,
  PlayerSpotlightPayload,
  PointsOverUnderPayload,
  TrendPayload,
} from "../types";

function FormGuideCard({ payload }: { payload: FormGuidePayload | BasketballFormGuidePayload }) {
  const matchCount = payload.matchCount ?? payload.teams[0]?.results.length ?? 5;
  const isBasketball = "avgPointsFor" in (payload.teams[0] ?? {});

  return (
    <div className="insight-card">
      <p className="card-meta form-match-count">Last {matchCount} matches</p>
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
            {isBasketball
              ? `${(team as BasketballFormGuidePayload["teams"][number]).pointsFor} pts for · ${(team as BasketballFormGuidePayload["teams"][number]).pointsAgainst} pts against · avg ${(team as BasketballFormGuidePayload["teams"][number]).avgPointsFor}`
              : `${(team as FormGuidePayload["teams"][number]).goalsFor} scored · ${(team as FormGuidePayload["teams"][number]).goalsAgainst} conceded`}
          </span>
        </div>
      ))}
    </div>
  );
}

function H2HCard({ payload }: { payload: H2HPayload | BasketballH2HPayload }) {
  const hasDraws = "draws" in payload.stats;

  return (
    <div className="insight-card">
      <p>{payload.summary}</p>
      <div className="h2h-stats">
        <span>W {payload.stats.homeTeamWins}</span>
        {hasDraws && <span>D {(payload.stats as H2HPayload["stats"]).draws}</span>}
        <span>L {payload.stats.awayTeamWins}</span>
        {"avgTotalPoints" in payload.stats && (
          <span>Avg {payload.stats.avgTotalPoints} pts</span>
        )}
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

function OverUnderCard({ payload }: { payload: OverUnderPayload }) {
  const recommendationLabel = {
    over: "Over",
    under: "Under",
    neutral: "Neutral",
  }[payload.recommendation];

  return (
    <div className="insight-card">
      <div className="ou-split">
        <div className="ou-stat">
          <span className="ou-stat-label">Over {payload.line}</span>
          <span className="ou-stat-value ou-stat-value--over">{Math.round(payload.overRate * 100)}%</span>
        </div>
        <div className="ou-stat">
          <span className="ou-stat-label">Under {payload.line}</span>
          <span className="ou-stat-value ou-stat-value--under">{Math.round(payload.underRate * 100)}%</span>
        </div>
      </div>
      <p className="ou-label">{payload.label}</p>
      <div className="ou-teams">
        <span>Home avg goals: {payload.homeTeam.avgTotalGoals}</span>
        <span>Away avg goals: {payload.awayTeam.avgTotalGoals}</span>
      </div>
      <span className={`ou-badge ou-badge--${payload.recommendation}`}>{recommendationLabel}</span>
    </div>
  );
}

function CorrectScoreCard({ payload }: { payload: CorrectScorePayload }) {
  return (
    <div className="insight-card">
      <p className="cs-label">{payload.label}</p>
      {payload.predictions.length > 0 ? (
        <ul className="cs-list">
          {payload.predictions.map((prediction) => (
            <li key={prediction.score} className="cs-item">
              <span className="cs-score">{prediction.score}</span>
              <span className="cs-probability">{Math.round(prediction.probability * 100)}%</span>
              <span className="cs-source">{prediction.source}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card-meta">No score predictions available.</p>
      )}
    </div>
  );
}

function HalfResultsCard({ payload }: { payload: HalfResultsPayload }) {
  const renderBreakdown = (label: string, breakdown: HalfResultsPayload["homeTeam"]) => (
    <div className="ht-row">
      <strong>{label}</strong>
      <div className="ht-stats">
        <span className="ht-stat ht-stat--win">W {breakdown.wins}</span>
        <span className="ht-stat ht-stat--draw">D {breakdown.draws}</span>
        <span className="ht-stat ht-stat--loss">L {breakdown.losses}</span>
      </div>
      <span className="card-meta">
        {Math.round(breakdown.winRate * 100)}% leading at HT
      </span>
    </div>
  );

  return (
    <div className="insight-card">
      <p className="ht-label">{payload.label}</p>
      {renderBreakdown("Home", payload.homeTeam)}
      {renderBreakdown("Away", payload.awayTeam)}
      {payload.h2h.meetings > 0 && (
        <div className="ht-h2h">
          <span className="card-meta">H2H at half-time</span>
          <div className="ht-stats">
            <span className="ht-stat ht-stat--win">Home {payload.h2h.homeWins}</span>
            <span className="ht-stat ht-stat--draw">Draw {payload.h2h.draws}</span>
            <span className="ht-stat ht-stat--loss">Away {payload.h2h.awayWins}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PointsOverUnderCard({ payload }: { payload: PointsOverUnderPayload }) {
  const recommendationLabel = {
    over: "Over",
    under: "Under",
    neutral: "Neutral",
  }[payload.recommendation];

  return (
    <div className="insight-card">
      <div className="ou-split">
        <div className="ou-stat">
          <span className="ou-stat-label">Over {payload.line}</span>
          <span className="ou-stat-value ou-stat-value--over">{Math.round(payload.overRate * 100)}%</span>
        </div>
        <div className="ou-stat">
          <span className="ou-stat-label">Under {payload.line}</span>
          <span className="ou-stat-value ou-stat-value--under">{Math.round(payload.underRate * 100)}%</span>
        </div>
      </div>
      <p className="ou-label">{payload.label}</p>
      <div className="ou-teams">
        <span>Home avg total: {payload.homeTeam.avgTotalPoints}</span>
        <span>Away avg total: {payload.awayTeam.avgTotalPoints}</span>
      </div>
      <span className={`ou-badge ou-badge--${payload.recommendation}`}>{recommendationLabel}</span>
    </div>
  );
}

function PlayerSpotlightCard({ payload }: { payload: PlayerSpotlightPayload }) {
  const renderPlayer = (
    label: string,
    player: NonNullable<PlayerSpotlightPayload["homePlayer"]>,
  ) => (
    <div className="player-row">
      <strong>{label}: {player.fullName}</strong>
      <span className="card-meta">{player.position ?? "—"} · {player.teamName}</span>
      <div className="player-averages">
        <span>{player.avgPoints} PPG</span>
        <span>{player.avgRebounds} RPG</span>
        <span>{player.avgAssists} APG</span>
      </div>
    </div>
  );

  return (
    <div className="insight-card">
      <p className="cs-label">{payload.label}</p>
      {payload.homePlayer && renderPlayer("Home", payload.homePlayer)}
      {payload.awayPlayer && renderPlayer("Away", payload.awayPlayer)}
    </div>
  );
}

function GamePreviewCard({ payload }: { payload: GamePreviewPayload }) {
  return (
    <div className="insight-card">
      <p>{payload.label}</p>
      <div className="preview-grid">
        <div>
          <strong>Home</strong>
          <p className="card-meta">{payload.homeRecord} · {payload.homeAvgPoints} PPG</p>
          {payload.homeConferenceRank && <p className="card-meta">Conf #{payload.homeConferenceRank}</p>}
        </div>
        <div>
          <strong>Away</strong>
          <p className="card-meta">{payload.awayRecord} · {payload.awayAvgPoints} PPG</p>
          {payload.awayConferenceRank && <p className="card-meta">Conf #{payload.awayConferenceRank}</p>}
        </div>
      </div>
      {(payload.venueName || payload.channel) && (
        <p className="card-meta">
          {payload.venueName ? `Venue: ${payload.venueName}` : ""}
          {payload.channel ? ` · TV: ${payload.channel}` : ""}
        </p>
      )}
    </div>
  );
}

interface Props {
  card: InsightCard;
}

const SECTION_CLASS: Record<InsightCard["type"], string> = {
  form_guide: "insight-section--form",
  h2h: "insight-section--h2h",
  trend: "insight-section--trend",
  over_under: "insight-section--over-under",
  correct_score: "insight-section--correct-score",
  half_results: "insight-section--half-results",
  points_over_under: "insight-section--over-under",
  player_spotlight: "insight-section--correct-score",
  game_preview: "insight-section--half-results",
};

export function InsightCardView({ card }: Props) {
  return (
    <section className={`card insight-section ${SECTION_CLASS[card.type]}`}>
      <h3>{card.title}</h3>
      {card.type === "form_guide" && (
        <FormGuideCard payload={card.payload as unknown as FormGuidePayload} />
      )}
      {card.type === "h2h" && <H2HCard payload={card.payload as unknown as H2HPayload} />}
      {card.type === "trend" && <TrendCard payload={card.payload as unknown as TrendPayload} />}
      {card.type === "over_under" && (
        <OverUnderCard payload={card.payload as unknown as OverUnderPayload} />
      )}
      {card.type === "correct_score" && (
        <CorrectScoreCard payload={card.payload as unknown as CorrectScorePayload} />
      )}
      {card.type === "half_results" && (
        <HalfResultsCard payload={card.payload as unknown as HalfResultsPayload} />
      )}
      {card.type === "points_over_under" && (
        <PointsOverUnderCard payload={card.payload as unknown as PointsOverUnderPayload} />
      )}
      {card.type === "player_spotlight" && (
        <PlayerSpotlightCard payload={card.payload as unknown as PlayerSpotlightPayload} />
      )}
      {card.type === "game_preview" && (
        <GamePreviewCard payload={card.payload as unknown as GamePreviewPayload} />
      )}
    </section>
  );
}
