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
  SpreadCoverPayload,
  TeamTotalPayload,
  TrendPayload,
} from "../types";

function pct(value: number) {
  return Math.round(value * 100);
}

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
  const homeWins = payload.stats.homeTeamWins;
  const awayWins = payload.stats.awayTeamWins;
  const draws = hasDraws ? (payload.stats as H2HPayload["stats"]).draws : 0;
  const total = Math.max(homeWins + awayWins + draws, 1);
  const homeShare = (homeWins / total) * 100;
  const drawShare = (draws / total) * 100;
  const awayShare = (awayWins / total) * 100;

  return (
    <div className="insight-card">
      <p>{payload.summary}</p>

      <div className="viz-stack-bar" role="img" aria-label={`Home ${homeWins}, Draw ${draws}, Away ${awayWins}`}>
        {homeShare > 0 && (
          <div className="viz-stack-seg viz-stack-seg--home" style={{ width: `${homeShare}%` }}>
            {homeShare >= 14 ? `${homeWins}` : ""}
          </div>
        )}
        {drawShare > 0 && (
          <div className="viz-stack-seg viz-stack-seg--draw" style={{ width: `${drawShare}%` }}>
            {drawShare >= 14 ? `${draws}` : ""}
          </div>
        )}
        {awayShare > 0 && (
          <div className="viz-stack-seg viz-stack-seg--away" style={{ width: `${awayShare}%` }}>
            {awayShare >= 14 ? `${awayWins}` : ""}
          </div>
        )}
      </div>

      <div className="viz-legend">
        <span className="viz-legend-item">
          <i className="viz-swatch viz-swatch--home" /> Home {homeWins}
          <em>{pct(homeWins / total)}%</em>
        </span>
        {hasDraws && (
          <span className="viz-legend-item">
            <i className="viz-swatch viz-swatch--draw" /> Draw {draws}
            <em>{pct(draws / total)}%</em>
          </span>
        )}
        <span className="viz-legend-item">
          <i className="viz-swatch viz-swatch--away" /> Away {awayWins}
          <em>{pct(awayWins / total)}%</em>
        </span>
      </div>

      {"avgTotalPoints" in payload.stats && (
        <p className="card-meta">Avg total points: {payload.stats.avgTotalPoints}</p>
      )}
      {"meetings" in payload.stats && (
        <p className="card-meta">{payload.stats.meetings} meetings in sample</p>
      )}
    </div>
  );
}

function SplitGauge({
  leftLabel,
  rightLabel,
  leftRate,
  rightRate,
  leftTone = "over",
  rightTone = "under",
}: {
  leftLabel: string;
  rightLabel: string;
  leftRate: number;
  rightRate: number;
  leftTone?: "over" | "yes" | "home";
  rightTone?: "under" | "no" | "away";
}) {
  const leftPct = pct(leftRate);
  const rightPct = pct(rightRate);

  return (
    <div className="viz-gauge">
      <div className="viz-gauge-track" role="img" aria-label={`${leftLabel} ${leftPct}%, ${rightLabel} ${rightPct}%`}>
        <div className={`viz-gauge-fill viz-gauge-fill--${leftTone}`} style={{ width: `${leftPct}%` }} />
        <div className={`viz-gauge-fill viz-gauge-fill--${rightTone}`} style={{ width: `${rightPct}%` }} />
      </div>
      <div className="viz-gauge-labels">
        <div className={`viz-gauge-side viz-gauge-side--${leftTone}`}>
          <span className="viz-gauge-pct">{leftPct}%</span>
          <span className="viz-gauge-name">{leftLabel}</span>
        </div>
        <div className={`viz-gauge-side viz-gauge-side--${rightTone}`}>
          <span className="viz-gauge-pct">{rightPct}%</span>
          <span className="viz-gauge-name">{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

function TrendCard({ payload }: { payload: TrendPayload }) {
  const yesRate = payload.value;
  const noRate = Math.max(0, 1 - payload.value);

  return (
    <div className="insight-card">
      <SplitGauge
        leftLabel="BTTS Yes"
        rightLabel="BTTS No"
        leftRate={yesRate}
        rightRate={noRate}
        leftTone="yes"
        rightTone="no"
      />
      <p className="ou-label">{payload.label}</p>
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
      <SplitGauge
        leftLabel={`Over ${payload.line}`}
        rightLabel={`Under ${payload.line}`}
        leftRate={payload.overRate}
        rightRate={payload.underRate}
      />
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
  const maxProb = Math.max(...payload.predictions.map((p) => p.probability), 0.01);

  return (
    <div className="insight-card">
      <p className="cs-label">{payload.label}</p>
      {payload.predictions.length > 0 ? (
        <ul className="viz-bar-list">
          {payload.predictions.map((prediction) => {
            const width = Math.max(8, (prediction.probability / maxProb) * 100);
            return (
              <li key={prediction.score} className="viz-bar-row">
                <span className="viz-bar-label">{prediction.score}</span>
                <div className="viz-bar-track">
                  <div className="viz-bar-fill" style={{ width: `${width}%` }}>
                    <span className="viz-bar-value">{pct(prediction.probability)}%</span>
                  </div>
                </div>
                <span className="viz-bar-source">{prediction.source}</span>
              </li>
            );
          })}
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
      <SplitGauge
        leftLabel={`Over ${payload.line}`}
        rightLabel={`Under ${payload.line}`}
        leftRate={payload.overRate}
        rightRate={payload.underRate}
      />
      <p className="ou-label">{payload.label}</p>
      <div className="ou-teams">
        <span>Home avg total: {payload.homeTeam.avgTotalPoints}</span>
        <span>Away avg total: {payload.awayTeam.avgTotalPoints}</span>
      </div>
      <span className={`ou-badge ou-badge--${payload.recommendation}`}>{recommendationLabel}</span>
    </div>
  );
}

function formatMargin(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function SpreadCoverCard({ payload }: { payload: SpreadCoverPayload }) {
  const primaryLine = payload.lines[1] ?? payload.lines[0] ?? 5.5;
  const homePrimary = payload.homeTeam.covers.find((c) => c.line === primaryLine)?.coverRate ?? 0;
  const awayPrimary = payload.awayTeam.covers.find((c) => c.line === primaryLine)?.coverRate ?? 0;

  const renderTeam = (team: SpreadCoverPayload["homeTeam"]) => (
    <div className="spread-team" key={team.name}>
      <div className="spread-team-header">
        <strong>{team.name}</strong>
        <span className="card-meta">Avg margin {formatMargin(team.avgMargin)}</span>
      </div>
      <ul className="viz-bar-list">
        {team.covers.map((cover) => {
          const width = Math.max(8, cover.coverRate * 100);
          return (
            <li key={`${team.name}-${cover.line}`} className="viz-bar-row viz-bar-row--spread">
              <span className="viz-bar-label">-{cover.line}</span>
              <div className="viz-bar-track">
                <div className="viz-bar-fill viz-bar-fill--spread" style={{ width: `${width}%` }}>
                  <span className="viz-bar-value">{pct(cover.coverRate)}%</span>
                </div>
              </div>
              <span className="viz-bar-source">
                {cover.coverCount}/{cover.sampleSize}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="insight-card">
      <div className="spread-primary">
        <p className="card-meta">Primary line -{primaryLine} cover rate</p>
        <div className="spread-primary-gauges">
          <div>
            <strong>{payload.homeTeam.name}</strong>
            <SplitGauge
              leftLabel="Cover"
              rightLabel="Miss"
              leftRate={homePrimary}
              rightRate={1 - homePrimary}
              leftTone="home"
              rightTone="away"
            />
          </div>
          <div>
            <strong>{payload.awayTeam.name}</strong>
            <SplitGauge
              leftLabel="Cover"
              rightLabel="Miss"
              leftRate={awayPrimary}
              rightRate={1 - awayPrimary}
              leftTone="home"
              rightTone="away"
            />
          </div>
        </div>
      </div>
      <p className="ou-label">{payload.label}</p>
      {renderTeam(payload.homeTeam)}
      {renderTeam(payload.awayTeam)}
      <p className="card-meta">{payload.h2h.label}</p>
    </div>
  );
}

function TeamTotalCard({ payload }: { payload: TeamTotalPayload }) {
  const renderSide = (side: TeamTotalPayload["homeTeam"]) => {
    const recommendationLabel = {
      over: "Over",
      under: "Under",
      neutral: "Neutral",
    }[side.recommendation];

    return (
      <div className="team-total-side" key={side.name}>
        <div className="spread-team-header">
          <strong>{side.name}</strong>
          <span className="card-meta">Avg {side.avgPointsFor} pts</span>
        </div>
        <SplitGauge
          leftLabel={`Over ${payload.line}`}
          rightLabel={`Under ${payload.line}`}
          leftRate={side.overRate}
          rightRate={side.underRate}
        />
        <span className={`ou-badge ou-badge--${side.recommendation}`}>{recommendationLabel}</span>
      </div>
    );
  };

  return (
    <div className="insight-card">
      <p className="ou-label">{payload.label}</p>
      {renderSide(payload.homeTeam)}
      {renderSide(payload.awayTeam)}
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
  spread_cover: "insight-section--spread",
  team_total: "insight-section--team-total",
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
      {card.type === "spread_cover" && (
        <SpreadCoverCard payload={card.payload as unknown as SpreadCoverPayload} />
      )}
      {card.type === "team_total" && (
        <TeamTotalCard payload={card.payload as unknown as TeamTotalPayload} />
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
