/**
 * React Email preview + export — a tiny Bun-native replacement for the
 * `react-email` CLI dev server, which pulls `@react-email/ui` → Next.js (~430 MB
 * of node_modules). Renders the same templates with `@react-email/components`
 * `render` — the exact path `EmailService` uses at runtime — so there is no CLI,
 * no `@react-email/ui`, and no Next.js.
 *
 *   bun scripts/email.ts              # dev preview server (default)
 *   bun scripts/email.ts export [dir] # render every template to <dir>/*.html
 */
import { readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { render } from '@react-email/components';
import { createElement, type FunctionComponent } from 'react';

const TEMPLATES_DIR = join(
  import.meta.dir,
  '..',
  'src',
  'notifications',
  'email',
  'templates',
);
/** Shared style helpers — not a renderable template. */
const IGNORE = new Set(['email-styles']);
const PORT = Number(process.env.EMAIL_PREVIEW_PORT ?? 3035);

type PreviewComponent = FunctionComponent<Record<string, unknown>> & {
  PreviewProps?: Record<string, unknown>;
};

const htmlResponse = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c,
  );

const templateNames = (): string[] =>
  readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.tsx'))
    .map(f => f.replace(/\.tsx$/, ''))
    .filter(n => !IGNORE.has(n))
    .sort();

/**
 * Render one template with its `PreviewProps` sample data. `bust` appends a
 * cache-busting query so Bun re-executes the module — giving a fresh render on
 * every request (live-edit) without restarting the server.
 */
async function renderTemplate(name: string, bust = false): Promise<string> {
  const spec =
    join(TEMPLATES_DIR, `${name}.tsx`) + (bust ? `?t=${Date.now()}` : '');
  const mod = (await import(spec)) as { default: PreviewComponent };
  const Template = mod.default;
  return render(createElement(Template, Template.PreviewProps ?? {}));
}

function indexPage(names: string[], current: string): string {
  const links = names
    .map(
      n =>
        `<a href="/?tpl=${encodeURIComponent(n)}"${n === current ? ' class="active"' : ''}>${n}</a>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Email preview</title><style>
    *{box-sizing:border-box}
    body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;display:flex;height:100vh}
    nav{width:240px;background:#0f172a;color:#e2e8f0;padding:16px;overflow:auto;flex-shrink:0}
    nav h1{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 12px}
    nav a{display:block;padding:8px 10px;border-radius:6px;color:#cbd5e1;text-decoration:none;font-size:14px}
    nav a:hover{background:#1e293b}nav a.active{background:#2563eb;color:#fff}
    main{flex:1;display:flex;flex-direction:column;background:#f1f5f9;min-width:0}
    header{padding:10px 16px;font:13px ui-monospace,monospace;color:#475569;border-bottom:1px solid #e2e8f0;display:flex;gap:16px;align-items:center}
    iframe{flex:1;border:0;background:#fff}label{font-size:13px;color:#475569;cursor:pointer}
  </style></head><body>
  <nav><h1>Templates</h1>${links || '<em style="color:#64748b">no templates</em>'}</nav>
  <main>
    <header><strong>${escapeHtml(current)}</strong><label><input type="checkbox" id="live" checked> live reload</label></header>
    <iframe id="frame" src="/preview/${encodeURIComponent(current)}"></iframe>
  </main>
  <script>
    const f=document.getElementById('frame'),live=document.getElementById('live');
    setInterval(()=>{try{if(live.checked)f.contentWindow.location.reload()}catch{}},1500);
  </script></body></html>`;
}

async function runExport(outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const names = templateNames();
  for (const name of names) {
    await writeFile(
      join(outDir, `${name}.html`),
      await renderTemplate(name),
      'utf8',
    );
    console.log(`✓ ${name}.html`);
  }
  console.log(`Exported ${names.length} template(s) → ${outDir}`);
}

function runDev(): void {
  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const names = templateNames();

      if (url.pathname === '/') {
        const current = url.searchParams.get('tpl') ?? names[0] ?? '';
        return htmlResponse(indexPage(names, current));
      }

      const preview = url.pathname.match(/^\/preview\/(.+)$/);
      if (preview) {
        const name = decodeURIComponent(preview[1]);
        if (!names.includes(name)) {
          return new Response('Unknown template', { status: 404 });
        }
        try {
          return htmlResponse(await renderTemplate(name, true));
        } catch (err) {
          const detail =
            err instanceof Error ? (err.stack ?? err.message) : String(err);
          return htmlResponse(
            `<pre style="color:#b91c1c;padding:16px;white-space:pre-wrap">${escapeHtml(detail)}</pre>`,
            500,
          );
        }
      }

      return new Response('Not found', { status: 404 });
    },
  });
  console.log(`📧 Email preview → http://localhost:${server.port}`);
}

const [mode, outArg] = process.argv.slice(2);
if (mode === 'export') {
  await runExport(outArg ?? 'out');
} else {
  runDev();
}
