import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Per-queue job counts (waiting/active/completed/…), as returned by bunqueue. */
export interface QueueCounts {
  waiting?: number;
  prioritized?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
  paused?: number;
}
export type QueueStats = Record<string, QueueCounts>;

/** Status columns rendered in a stable order, each with a color accent. */
const STATUSES = [
  { key: 'active', label: 'Active', tone: 'active' },
  { key: 'waiting', label: 'Waiting', tone: 'waiting' },
  { key: 'delayed', label: 'Delayed', tone: 'delayed' },
  { key: 'prioritized', label: 'Prioritized', tone: 'prioritized' },
  { key: 'completed', label: 'Completed', tone: 'completed' },
  { key: 'failed', label: 'Failed', tone: 'failed' },
  { key: 'paused', label: 'Paused', tone: 'paused' },
] as const;

const CSS = `
:root{color-scheme:light dark;
  --bg:#f6f7f9;--panel:#ffffff;--border:#e3e6ea;--text:#1a1d21;--muted:#6b7280;
  --active:#2563eb;--waiting:#d97706;--delayed:#7c3aed;--prioritized:#0d9488;
  --completed:#16a34a;--failed:#dc2626;--paused:#6b7280;}
@media (prefers-color-scheme:dark){:root{
  --bg:#0d1117;--panel:#161b22;--border:#272e36;--text:#e6edf3;--muted:#8b949e;
  --active:#4c8dff;--waiting:#f0a83c;--delayed:#a875f5;--prioritized:#2dd4bf;
  --completed:#3fb950;--failed:#f85149;--paused:#8b949e;}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;line-height:1.4}
.wrap{max-width:1000px;margin:0 auto;padding:2rem 1.25rem 3rem}
header{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem 1rem;margin-bottom:1.5rem}
h1{font-size:1.5rem;margin:0;font-weight:650;letter-spacing:-.02em}
.sub{color:var(--muted);font-size:.875rem}
.spacer{flex:1}
.tools{display:flex;gap:1rem;align-items:center;font-size:.8rem;color:var(--muted)}
.tools a{color:var(--active);text-decoration:none;font-weight:600}
.tools a:hover{text-decoration:underline}
.summary{display:flex;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem}
.stat{background:var(--panel);border:1px solid var(--border);border-radius:12px;
  padding:.65rem 1rem;min-width:120px}
.stat .n{font-size:1.4rem;font-weight:700;font-variant-numeric:tabular-nums}
.stat .l{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.stat.alert .n{color:var(--failed)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;
  padding:1.1rem 1.25rem;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.card h2{margin:0 0 .9rem;font-size:.95rem;font-weight:650;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:.55rem}
.tile{display:flex;align-items:center;justify-content:space-between;
  border:1px solid var(--border);border-radius:9px;padding:.45rem .7rem}
.tile .dot{width:.55rem;height:.55rem;border-radius:50%;display:inline-block;margin-right:.5rem}
.tile .lbl{font-size:.8rem;color:var(--muted);display:flex;align-items:center}
.tile .val{font-weight:700;font-variant-numeric:tabular-nums}
.tile.zero{opacity:.5}
.tile.hot{border-color:var(--failed)}
.tile.hot .val{color:var(--failed)}
.t-active .dot{background:var(--active)}
.t-waiting .dot{background:var(--waiting)}
.t-delayed .dot{background:var(--delayed)}
.t-prioritized .dot{background:var(--prioritized)}
.t-completed .dot{background:var(--completed)}
.t-failed .dot{background:var(--failed)}
.t-paused .dot{background:var(--paused)}
.empty{background:var(--panel);border:1px dashed var(--border);border-radius:14px;
  padding:2.5rem;text-align:center;color:var(--muted)}
footer{margin-top:2rem;font-size:.75rem;color:var(--muted)}
`;

const sum = (counts: QueueCounts): number =>
  Object.values(counts).reduce((a, b) => a + (b || 0), 0);

const QueueCard = ({ name, counts }: { name: string; counts: QueueCounts }) => (
  <div className="card">
    <h2>{name}</h2>
    <div className="tiles">
      {STATUSES.map(({ key, label, tone }) => {
        const value = counts[key] ?? 0;
        const hot = tone === 'failed' && value > 0;
        const cls = `tile t-${tone}${value === 0 ? ' zero' : ''}${hot ? ' hot' : ''}`;
        return (
          <div key={key} className={cls}>
            <span className="lbl">
              <span className="dot" />
              {label}
            </span>
            <span className="val">{value}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export const QueueDashboardView = ({
  stats,
  generatedAt,
}: {
  stats: QueueStats;
  generatedAt: string;
}) => {
  const queues = Object.entries(stats);
  const totalQueues = queues.length;
  const totalJobs = queues.reduce((acc, [, c]) => acc + sum(c), 0);
  const totalFailed = queues.reduce((acc, [, c]) => acc + (c.failed ?? 0), 0);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="refresh" content="5" />
        <title>Queues · bunqueue</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div className="wrap">
          <header>
            <h1>Queues</h1>
            <span className="sub">bunqueue · SQLite-backed</span>
            <span className="spacer" />
            <span className="tools">
              <span>auto-refresh 5s</span>
              <a href="queues/stats">JSON</a>
            </span>
          </header>

          <div className="summary">
            <div className="stat">
              <div className="n">{totalQueues}</div>
              <div className="l">Queues</div>
            </div>
            <div className="stat">
              <div className="n">{totalJobs}</div>
              <div className="l">Total jobs</div>
            </div>
            <div className={`stat${totalFailed > 0 ? ' alert' : ''}`}>
              <div className="n">{totalFailed}</div>
              <div className="l">Failed</div>
            </div>
          </div>

          {totalQueues === 0 ? (
            <div className="empty">No queues registered.</div>
          ) : (
            <div className="grid">
              {queues.map(([name, counts]) => (
                <QueueCard key={name} name={name} counts={counts} />
              ))}
            </div>
          )}

          <footer>Generated {generatedAt}</footer>
        </div>
      </body>
    </html>
  );
};

/** Renders the dashboard component to a complete, self-contained HTML string. */
export const renderQueueDashboard = (stats: QueueStats): string => {
  const generatedAt = `${new Date().toISOString().slice(11, 19)} UTC`;
  return `<!doctype html>${renderToStaticMarkup(
    <QueueDashboardView stats={stats} generatedAt={generatedAt} />,
  )}`;
};
