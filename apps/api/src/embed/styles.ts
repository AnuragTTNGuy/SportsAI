/** Self-contained CSS for iframe widgets (matches web insight visuals). */
export const EMBED_WIDGET_CSS = `
:root {
  --bg-deep: #0c1220;
  --bg-card: #1a2438;
  --border: #2d3a52;
  --text: #eef2f8;
  --text-muted: #94a3b8;
  --win: #22c55e;
  --draw: #eab308;
  --loss: #ef4444;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 12px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--bg-deep);
  color: var(--text);
  font-size: 14px;
  line-height: 1.45;
}
.widget {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
}
.widget h2 {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 700;
}
.widget p { margin: 0.35rem 0; }
.meta { color: var(--text-muted); font-size: 0.85rem; }
.error { color: #f87171; }
.form-row { margin-bottom: 10px; }
.form-results { display: flex; gap: 4px; margin: 6px 0; }
.result {
  width: 1.6rem;
  height: 1.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 800;
}
.result-w { background: rgba(34, 197, 94, 0.25); color: var(--win); }
.result-d { background: rgba(234, 179, 8, 0.25); color: var(--draw); }
.result-l { background: rgba(239, 68, 68, 0.25); color: var(--loss); }
.viz-stack-bar {
  display: flex;
  width: 100%;
  height: 2rem;
  margin: 10px 0 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
}
.viz-stack-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: #0c1220;
  min-width: 0;
}
.viz-stack-seg--home { background: linear-gradient(90deg, #22c55e, #4ade80); }
.viz-stack-seg--draw { background: linear-gradient(90deg, #eab308, #facc15); }
.viz-stack-seg--away { background: linear-gradient(90deg, #ef4444, #f87171); }
.viz-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-bottom: 6px; font-size: 0.85rem; }
.viz-legend em { font-style: normal; color: var(--text-muted); margin-left: 4px; }
.viz-swatch {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  margin-right: 4px;
  vertical-align: middle;
}
.viz-swatch--home { background: var(--win); }
.viz-swatch--draw { background: var(--draw); }
.viz-swatch--away { background: var(--loss); }
.viz-gauge { margin: 8px 0; }
.viz-gauge-track {
  display: flex;
  width: 100%;
  height: 0.85rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
}
.viz-gauge-fill { height: 100%; min-width: 0; }
.viz-gauge-fill--over, .viz-gauge-fill--yes, .viz-gauge-fill--home {
  background: linear-gradient(90deg, #2563eb, #60a5fa);
}
.viz-gauge-fill--under, .viz-gauge-fill--no, .viz-gauge-fill--away {
  background: linear-gradient(90deg, #d97706, #fbbf24);
}
.viz-gauge-fill--yes { background: linear-gradient(90deg, #ea580c, #fb923c); }
.viz-gauge-fill--no { background: linear-gradient(90deg, #64748b, #94a3b8); }
.viz-gauge-labels {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}
.viz-gauge-side:last-child { text-align: right; }
.viz-gauge-pct { font-size: 1.35rem; font-weight: 800; line-height: 1.1; }
.viz-gauge-name { font-size: 0.78rem; color: var(--text-muted); }
.viz-bar-list { list-style: none; margin: 0; padding: 0; }
.viz-bar-row {
  display: grid;
  grid-template-columns: 3rem 1fr 3.5rem;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.viz-bar-label { font-weight: 800; color: #5eead4; }
.viz-bar-track {
  height: 1.25rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  overflow: hidden;
}
.viz-bar-fill {
  height: 100%;
  border-radius: 7px;
  background: linear-gradient(90deg, rgba(20, 184, 166, 0.35), rgba(45, 212, 191, 0.85));
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 6px;
  min-width: 2.25rem;
}
.viz-bar-value { font-size: 0.68rem; font-weight: 700; color: #ecfeff; }
.viz-bar-source { font-size: 0.68rem; color: var(--text-muted); text-align: right; }
.viz-bar-fill--spread {
  background: linear-gradient(90deg, rgba(168, 85, 247, 0.35), rgba(192, 132, 252, 0.9));
}
.board .widget { margin-bottom: 12px; }
.badge {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.badge--over, .badge--yes { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
.badge--under, .badge--no { background: rgba(217, 119, 6, 0.2); color: #fcd34d; }
.badge--neutral { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }
`;
