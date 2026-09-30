import type { InsightCard } from "@sports-insights/shared";
import { EMBED_WIDGET_CSS } from "./styles.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pct(rate: number): number {
  return Math.round(rate * 100);
}

function asRecord(payload: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = payload[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function splitGaugeHtml(
  leftLabel: string,
  rightLabel: string,
  leftRate: number,
  rightRate: number,
  leftTone = "over",
  rightTone = "under",
): string {
  const leftPct = pct(leftRate);
  const rightPct = pct(rightRate);
  return `
    <div class="viz-gauge">
      <div class="viz-gauge-track">
        <div class="viz-gauge-fill viz-gauge-fill--${leftTone}" style="width:${leftPct}%"></div>
        <div class="viz-gauge-fill viz-gauge-fill--${rightTone}" style="width:${rightPct}%"></div>
      </div>
      <div class="viz-gauge-labels">
        <div class="viz-gauge-side">
          <span class="viz-gauge-pct">${leftPct}%</span>
          <span class="viz-gauge-name">${escapeHtml(leftLabel)}</span>
        </div>
        <div class="viz-gauge-side">
          <span class="viz-gauge-pct">${rightPct}%</span>
          <span class="viz-gauge-name">${escapeHtml(rightLabel)}</span>
        </div>
      </div>
    </div>`;
}

function renderFormGuide(payload: Record<string, unknown>): string {
  const teams = Array.isArray(payload.teams) ? payload.teams : [];
  const rows = teams.map((team) => {
    const t = team as Record<string, unknown>;
    const name = String(t.name ?? "Team");
    const results = Array.isArray(t.results) ? t.results : [];
    const pills = results.map((r) => {
      const code = String(r).toLowerCase();
      const cls = code === "w" ? "result-w" : code === "d" ? "result-d" : "result-l";
      return `<span class="result ${cls}">${escapeHtml(String(r))}</span>`;
    }).join("");
    const meta = t.goalsFor != null
      ? `${t.goalsFor} scored · ${t.goalsAgainst} conceded`
      : `${t.pointsFor} pts for · ${t.pointsAgainst} pts against`;
    return `
      <div class="form-row">
        <strong>${escapeHtml(name)}</strong>
        <div class="form-results">${pills}</div>
        <span class="meta">${escapeHtml(String(meta))}</span>
      </div>`;
  }).join("");
  return rows || `<p class="meta">No form data.</p>`;
}

function renderH2H(payload: Record<string, unknown>): string {
  const summary = String(payload.summary ?? "");
  const stats = asRecord(payload, "stats") ?? {};
  const homeWins = asNumber(stats.homeTeamWins);
  const awayWins = asNumber(stats.awayTeamWins);
  const draws = asNumber(stats.draws);
  const total = Math.max(homeWins + awayWins + draws, 1);
  const homeShare = (homeWins / total) * 100;
  const drawShare = (draws / total) * 100;
  const awayShare = (awayWins / total) * 100;

  const segs = [
    homeShare > 0
      ? `<div class="viz-stack-seg viz-stack-seg--home" style="width:${homeShare}%">${homeShare >= 14 ? homeWins : ""}</div>`
      : "",
    drawShare > 0
      ? `<div class="viz-stack-seg viz-stack-seg--draw" style="width:${drawShare}%">${drawShare >= 14 ? draws : ""}</div>`
      : "",
    awayShare > 0
      ? `<div class="viz-stack-seg viz-stack-seg--away" style="width:${awayShare}%">${awayShare >= 14 ? awayWins : ""}</div>`
      : "",
  ].join("");

  const drawLegend = draws > 0 || stats.draws != null
    ? `<span class="viz-legend-item"><i class="viz-swatch viz-swatch--draw"></i> Draw ${draws}<em>${pct(draws / total)}%</em></span>`
    : "";

  const extra = stats.avgTotalPoints != null
    ? `<p class="meta">Avg total points: ${escapeHtml(String(stats.avgTotalPoints))}</p>`
    : "";

  return `
    <p>${escapeHtml(summary)}</p>
    <div class="viz-stack-bar">${segs}</div>
    <div class="viz-legend">
      <span class="viz-legend-item"><i class="viz-swatch viz-swatch--home"></i> Home ${homeWins}<em>${pct(homeWins / total)}%</em></span>
      ${drawLegend}
      <span class="viz-legend-item"><i class="viz-swatch viz-swatch--away"></i> Away ${awayWins}<em>${pct(awayWins / total)}%</em></span>
    </div>
    ${extra}`;
}

function renderOverUnderGauge(payload: Record<string, unknown>, lineKey = "line"): string {
  const line = asNumber(payload[lineKey], 2.5);
  const overRate = asNumber(payload.overRate);
  const underRate = asNumber(payload.underRate, 1 - overRate);
  const label = String(payload.label ?? "");
  const rec = String(payload.recommendation ?? "neutral");
  return `
    ${splitGaugeHtml(`Over ${line}`, `Under ${line}`, overRate, underRate)}
    <p class="meta">${escapeHtml(label)}</p>
    <span class="badge badge--${escapeHtml(rec)}">${escapeHtml(rec)}</span>`;
}

function renderCorrectScore(payload: Record<string, unknown>): string {
  const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];
  if (predictions.length === 0) return `<p class="meta">No score predictions.</p>`;
  const probs = predictions.map((p) => asNumber((p as Record<string, unknown>).probability));
  const maxProb = Math.max(...probs, 0.01);
  const items = predictions.map((p) => {
    const row = p as Record<string, unknown>;
    const score = String(row.score ?? "?");
    const prob = asNumber(row.probability);
    const width = Math.max(8, (prob / maxProb) * 100);
    const source = String(row.source ?? "");
    return `
      <li class="viz-bar-row">
        <span class="viz-bar-label">${escapeHtml(score)}</span>
        <div class="viz-bar-track">
          <div class="viz-bar-fill" style="width:${width}%">
            <span class="viz-bar-value">${pct(prob)}%</span>
          </div>
        </div>
        <span class="viz-bar-source">${escapeHtml(source)}</span>
      </li>`;
  }).join("");
  return `<ul class="viz-bar-list">${items}</ul>`;
}

function renderSpreadCover(payload: Record<string, unknown>): string {
  const lines = Array.isArray(payload.lines) ? payload.lines.map((l) => asNumber(l)) : [5.5];
  const primary = lines[1] ?? lines[0] ?? 5.5;
  const homeTeam = asRecord(payload, "homeTeam") ?? {};
  const awayTeam = asRecord(payload, "awayTeam") ?? {};
  const homeCovers = Array.isArray(homeTeam.covers) ? homeTeam.covers : [];
  const awayCovers = Array.isArray(awayTeam.covers) ? awayTeam.covers : [];
  const homePrimary = homeCovers.find((c) => asNumber((c as Record<string, unknown>).line) === primary);
  const awayPrimary = awayCovers.find((c) => asNumber((c as Record<string, unknown>).line) === primary);
  const homeRate = asNumber((homePrimary as Record<string, unknown> | undefined)?.coverRate);
  const awayRate = asNumber((awayPrimary as Record<string, unknown> | undefined)?.coverRate);

  const renderBars = (team: Record<string, unknown>) => {
    const covers = Array.isArray(team.covers) ? team.covers : [];
    const name = String(team.name ?? "Team");
    const margin = team.avgMargin != null ? String(team.avgMargin) : "0";
    const bars = covers.map((cover) => {
      const c = cover as Record<string, unknown>;
      const line = asNumber(c.line);
      const rate = asNumber(c.coverRate);
      const count = asNumber(c.coverCount);
      const sample = asNumber(c.sampleSize);
      const width = Math.max(8, rate * 100);
      return `
        <li class="viz-bar-row">
          <span class="viz-bar-label">-${line}</span>
          <div class="viz-bar-track">
            <div class="viz-bar-fill viz-bar-fill--spread" style="width:${width}%">
              <span class="viz-bar-value">${pct(rate)}%</span>
            </div>
          </div>
          <span class="viz-bar-source">${count}/${sample}</span>
        </li>`;
    }).join("");
    return `
      <div class="form-row">
        <strong>${escapeHtml(name)}</strong>
        <span class="meta">Avg margin ${escapeHtml(margin)}</span>
        <ul class="viz-bar-list">${bars}</ul>
      </div>`;
  };

  const h2h = asRecord(payload, "h2h");
  const h2hLabel = h2h?.label ? `<p class="meta">${escapeHtml(String(h2h.label))}</p>` : "";

  return `
    <p class="meta">Primary line -${primary}</p>
    <strong>${escapeHtml(String(homeTeam.name ?? "Home"))}</strong>
    ${splitGaugeHtml("Cover", "Miss", homeRate, 1 - homeRate, "home", "away")}
    <strong>${escapeHtml(String(awayTeam.name ?? "Away"))}</strong>
    ${splitGaugeHtml("Cover", "Miss", awayRate, 1 - awayRate, "home", "away")}
    ${renderBars(homeTeam)}
    ${renderBars(awayTeam)}
    ${h2hLabel}`;
}

function renderTeamTotal(payload: Record<string, unknown>): string {
  const line = asNumber(payload.line, 112.5);
  const renderSide = (side: Record<string, unknown>) => {
    const name = String(side.name ?? "Team");
    const over = asNumber(side.overRate);
    const rec = String(side.recommendation ?? "neutral");
    const avg = side.avgPointsFor != null ? String(side.avgPointsFor) : "—";
    return `
      <div class="form-row">
        <strong>${escapeHtml(name)}</strong>
        <span class="meta">Avg ${escapeHtml(avg)} pts</span>
        ${splitGaugeHtml(`Over ${line}`, `Under ${line}`, over, 1 - over)}
        <span class="badge badge--${escapeHtml(rec)}">${escapeHtml(rec)}</span>
      </div>`;
  };
  const home = asRecord(payload, "homeTeam") ?? {};
  const away = asRecord(payload, "awayTeam") ?? {};
  const label = String(payload.label ?? "");
  return `
    <p class="meta">${escapeHtml(label)}</p>
    ${renderSide(home)}
    ${renderSide(away)}`;
}

function renderTrend(payload: Record<string, unknown>): string {
  const value = asNumber(payload.value);
  const label = String(payload.label ?? "");
  return `
    ${splitGaugeHtml("BTTS Yes", "BTTS No", value, 1 - value, "yes", "no")}
    <p class="meta">${escapeHtml(label)}</p>`;
}

function renderCardBody(card: InsightCard): string {
  const payload = card.payload;
  switch (card.type) {
    case "form_guide":
      return renderFormGuide(payload);
    case "h2h":
      return renderH2H(payload);
    case "trend":
      return renderTrend(payload);
    case "over_under":
    case "points_over_under":
      return renderOverUnderGauge(payload);
    case "correct_score":
      return renderCorrectScore(payload);
    case "spread_cover":
      return renderSpreadCover(payload);
    case "team_total":
      return renderTeamTotal(payload);
    default:
      return `<p class="meta">${escapeHtml(card.title)}</p><pre class="meta">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  }
}

export function renderWidgetHtml(options: {
  title: string;
  bodyHtml: string;
  board?: boolean;
}): string {
  const boardClass = options.board ? " board" : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <style>${EMBED_WIDGET_CSS}</style>
</head>
<body class="${boardClass.trim()}">
  <div class="widget">
    <h2>${escapeHtml(options.title)}</h2>
    ${options.bodyHtml}
  </div>
</body>
</html>`;
}

export function renderInsightCardWidget(card: InsightCard): string {
  return renderWidgetHtml({
    title: card.title,
    bodyHtml: renderCardBody(card),
  });
}

export function renderInsightBoardHtml(title: string, cards: InsightCard[]): string {
  const sections = cards.map((card) => `
    <div class="widget">
      <h2>${escapeHtml(card.title)}</h2>
      ${renderCardBody(card)}
    </div>`).join("");
  const body = sections || `<div class="widget"><p class="meta">No insight cards available.</p></div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${EMBED_WIDGET_CSS}</style>
</head>
<body class="board">
  <h2 style="margin:0 0 12px;font-size:1rem;">${escapeHtml(title)}</h2>
  ${body}
</body>
</html>`;
}

export function renderEmbedErrorHtml(message: string): string {
  return renderWidgetHtml({
    title: "Widget unavailable",
    bodyHtml: `<p class="error">${escapeHtml(message)}</p>`,
  });
}
