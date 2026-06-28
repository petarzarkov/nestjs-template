import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { Glob } from 'bun';

/**
 * Bun-native production build — replaces `nest build` + `tsc-alias`.
 *
 * We transpile every source file to its own output file (1:1, structure
 * preserving) instead of bundling, because:
 *   1. Bun's *bundler* (`Bun.build`) miscompiles this app's decorators — in a
 *      full-app bundle some field-decorated classes (entities/DTOs) get emitted
 *      with the TC39 standard decorator transform instead of legacy
 *      (`experimentalDecorators`), which crashes class-validator/TypeORM at
 *      boot. The same files compile correctly file-by-file, so we transpile.
 *   2. TypeORM discovers entities/migrations at runtime via globs
 *      (`dist/**\/*.entity.js`, `dist/infra/db/migrations/**\/*.js`), and
 *      `mig:run:prod` runs against `dist/infra/db/data-source-options.js` — a
 *      single bundle would leave nothing for those to find.
 *
 * `Bun.Transpiler` only strips types / lowers decorators; it does NOT resolve
 * the `@/*` path alias, so we rewrite those specifiers to relative paths here
 * (the job `tsc-alias` + `tsconfig.alias.json` used to do).
 */

const ROOT = join(import.meta.dir, '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');

const tsconfig = JSON.stringify({
  compilerOptions: {
    target: 'esnext',
    jsx: 'react',
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  },
});

// `trimUnusedImports` elides type-only imports (e.g. `import { Repository }`
// used only in annotations) that would otherwise fail at runtime, while keeping
// side-effect imports (`reflect-metadata`) and the class imports that
// `emitDecoratorMetadata` references in `design:paramtypes` for Nest DI.
const transpilers = {
  ts: new Bun.Transpiler({ loader: 'ts', tsconfig, trimUnusedImports: true }),
  tsx: new Bun.Transpiler({ loader: 'tsx', tsconfig, trimUnusedImports: true }),
};

/** Rewrite `@/foo/bar` specifiers to a path relative to the output file. */
function resolveAlias(code: string, outFile: string): string {
  const toRoot = relative(dirname(outFile), OUT).replaceAll('\\', '/');
  const prefix = toRoot === '' ? '.' : toRoot;
  return code.replace(
    /(['"])@\/([^'"]+)\1/g,
    (_match, quote, rest) => `${quote}${prefix}/${rest}${quote}`,
  );
}

// Without a file path, `Bun.Transpiler` injects a stub for files that reference
// `__dirname`/`__filename` (e.g. `var __dirname = "", __filename = "input.ts";`).
// That breaks runtime path resolution (e.g. the BullMQ processor lookup). Strip
// it so Bun's runtime provides the real values for each output file.
function stripDirnameStub(code: string): string {
  return code.replace(
    /^var (?:__dirname|__filename) = "[^"]*"(?:, (?:__dirname|__filename) = "[^"]*")*;\n?/gm,
    '',
  );
}

await rm(OUT, { recursive: true, force: true });

const glob = new Glob('**/*.{ts,tsx}');
const jobs: Promise<void>[] = [];

for await (const rel of glob.scan({ cwd: SRC })) {
  if (
    rel.endsWith('.spec.ts') ||
    rel.endsWith('.test.ts') ||
    rel.endsWith('.d.ts')
  ) {
    continue;
  }

  const loader = rel.endsWith('.tsx') ? 'tsx' : 'ts';
  const srcPath = join(SRC, rel);
  const outPath = join(OUT, rel.replace(/\.tsx?$/, '.js'));

  jobs.push(
    (async () => {
      const source = await Bun.file(srcPath).text();
      const js = resolveAlias(
        stripDirnameStub(transpilers[loader].transformSync(source)),
        outPath,
      );
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, js);
    })(),
  );
}

await Promise.all(jobs);

console.log(`✅ Transpiled ${jobs.length} files to dist/`);
