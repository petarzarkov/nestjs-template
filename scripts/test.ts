import { Glob } from 'bun';

/**
 * Test runner.
 *
 * Resolves glob patterns with `Bun.Glob` (which handles `**` across nested
 * directories reliably — the package.json shell does NOT) and runs `bun test`
 * over the matched files.
 *
 * Why this exists: our integration tests use the `*.int.ts` extension, which
 * `bun test` does not auto-discover (it only auto-discovers `*.test.ts` /
 * `*.spec.ts`). So integration/e2e runs must pass explicit file paths, and we
 * cannot depend on shell globbing to produce them correctly.
 *
 * Usage:
 *   bun scripts/test.ts [bun test flags...] -- <glob> [<glob>...]
 *
 * Everything before `--` is forwarded verbatim to `bun test` (e.g. `--coverage`,
 * `--env-file=...`, `--preload <path>`); everything after `--` is a glob pattern
 * resolved relative to the current working directory.
 */
const argv = process.argv.slice(2);
const separator = argv.indexOf('--');
const passthrough = separator === -1 ? [] : argv.slice(0, separator);
const patterns = separator === -1 ? argv : argv.slice(separator + 1);

if (patterns.length === 0) {
  console.error('Usage: bun scripts/test.ts [bun test flags] -- <glob>...');
  process.exit(1);
}

const files = new Set<string>();
for (const pattern of patterns) {
  for await (const file of new Glob(pattern).scan({ cwd: process.cwd() })) {
    files.add(file);
  }
}

if (files.size === 0) {
  console.error(`No test files matched: ${patterns.join(', ')}`);
  process.exit(1);
}

// Prefix with `./` so `bun test` treats each as an explicit PATH (which it runs
// regardless of the filename pattern) rather than a name filter (which only
// narrows auto-discovered *.test.ts / *.spec.ts files, missing our *.int.ts).
const paths = [...files].sort().map(file => `./${file}`);

const proc = Bun.spawn([process.execPath, 'test', ...passthrough, ...paths], {
  stdio: ['inherit', 'inherit', 'inherit'],
});
process.exit(await proc.exited);
