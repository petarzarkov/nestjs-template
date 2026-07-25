import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { Glob } from 'bun';

/**
 * Bun-native production build — replaces `nest build` + `tsc-alias`.
 *
 * Every source file is transpiled to its own output file (1:1, structure
 * preserving): we hand `Bun.build` all files as entrypoints with
 * `external: ['*']`, so it transpiles each in place and never bundles them.
 *
 * The 1:1 layout is REQUIRED, not cosmetic — two runtime lookups resolve paths
 * relative to their own file location, so they only work if the source tree is
 * mirrored in `dist/`:
 *   - the boot-time migrator reads `join(import.meta.dir, 'migrations')` from
 *     `infra/db/client.ts` → needs `dist/infra/db/migrations`
 *   - BullMQ spawns the sandboxed worker from `join(__dirname, '../job.processor')`
 *     in `infra/queue/services/job-dispatcher.service.ts` → needs a standalone
 *     `dist/infra/queue/job.processor.js`
 * A full bundle collapses everything into `dist/main.js`, making both
 * `import.meta.dir`/`__dirname` resolve to `dist/` and breaking both. (Bundling
 * also used to miscompile decorators; that appears fixed in current Bun, but the
 * path-resolution constraint above stands regardless.)
 *
 * Consequences of staying per-file (`external: ['*']`):
 *   - Bun does NOT resolve the `@/*` alias for external specifiers (even with
 *     `tsconfig` passed), so we rewrite those to relative paths afterwards
 *     (`resolveAlias`, line-preserving so the emitted source maps stay valid).
 *   - The Drizzle migration `.sql`/`.json` are never `import`ed (the migrator
 *     reads them from disk), so Bun won't emit them — we copy them verbatim.
 *
 * `sourcemap: 'linked'` emits a `.js.map` (with embedded `sourcesContent`) next
 * to each file, so production stack traces from `bun dist/main.js` remap to the
 * original `.ts` lines — Bun loads the map automatically at runtime, no flag.
 */

const ROOT = join(import.meta.dir, '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
const TSCONFIG = join(ROOT, 'tsconfig.json');

/** Rewrite `@/foo/bar` specifiers to a path relative to the output file. */
function resolveAlias(code: string, outFile: string): string {
  const toRoot = relative(dirname(outFile), OUT).replaceAll('\\', '/');
  const prefix = toRoot === '' ? '.' : toRoot;
  return code.replace(
    /(['"])@\/([^'"]+)\1/g,
    (_match, quote, rest) => `${quote}${prefix}/${rest}${quote}`,
  );
}

await rm(OUT, { recursive: true, force: true });

// Collect every source file (skip tests + ambient decls) as its own entrypoint.
const entrypoints: string[] = [];
for await (const rel of new Glob('**/*.{ts,tsx}').scan({ cwd: SRC })) {
  if (
    rel.endsWith('.spec.ts') ||
    rel.endsWith('.test.ts') ||
    rel.endsWith('.d.ts')
  ) {
    continue;
  }
  entrypoints.push(join(SRC, rel));
}

const started = performance.now();

const result = await Bun.build({
  entrypoints,
  outdir: OUT,
  root: SRC,
  target: 'bun',
  external: ['*'],
  splitting: false,
  sourcemap: 'linked',
  metafile: true,
  // Resolve jsx/decorator settings from the project's tsconfig explicitly (so
  // the build is independent of cwd-based auto-detection).
  tsconfig: TSCONFIG,
  // Bun inlines `process.env.NODE_ENV` to its BUILD-TIME value by default (a
  // bundler special-case, NOT governed by the `env` option). This server reads
  // all config from the environment at RUNTIME (env is parsed as a whole object
  // via AppConfigService), so map NODE_ENV back to itself to keep it a live
  // reference — nothing about the environment is ever frozen into `dist`.
  define: { 'process.env.NODE_ENV': 'process.env.NODE_ENV' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new AggregateError(result.logs, 'Build failed');
}

// Rewrite the `@/*` alias in every emitted JS file (line-preserving, so the
// source maps stay valid).
const jsOutputs = result.outputs.filter(o => o.kind === 'entry-point');
await Promise.all(
  jsOutputs.map(async output => {
    const code = await Bun.file(output.path).text();
    const rewritten = resolveAlias(code, output.path);
    if (rewritten !== code) await writeFile(output.path, rewritten);
  }),
);

// Copy non-TS runtime assets that the build skips: the Drizzle migration SQL +
// journal, applied on boot by `migrate()` (see infra/db/client.ts).
const assetGlob = new Glob('infra/db/migrations/**/*.{sql,json}');
let assetCount = 0;
for await (const rel of assetGlob.scan({ cwd: SRC })) {
  const outPath = join(OUT, rel);
  await mkdir(dirname(outPath), { recursive: true });
  await Bun.write(outPath, Bun.file(join(SRC, rel)));
  assetCount++;
}

// Persist + summarize the build metafile (input/output graph + byte sizes).
const durationMs = Math.round(performance.now() - started);
let totalBytes = 0;
if (result.metafile) {
  await writeFile(
    join(OUT, 'meta.json'),
    JSON.stringify(result.metafile, null, 2),
  );
  totalBytes = Object.values(result.metafile.outputs).reduce(
    (sum, o) => sum + o.bytes,
    0,
  );
}
console.log(
  `✅ Built ${jsOutputs.length} files (+${jsOutputs.length} source maps, +${assetCount} migration assets), ` +
    `${(totalBytes / 1024).toFixed(1)} KiB JS, in ${durationMs}ms → dist/ (metafile: dist/meta.json)`,
);
