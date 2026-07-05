/**
 * Run the project's own lint + format scripts on pre-commit (a single source of
 * truth with CI / `bun run lint` / `bun run format`) rather than per-file
 * commands. The functions ignore lint-staged's staged-file list so the scripts'
 * fixed targets (`src e2e scripts` for lint, whole repo for format) are used —
 * this also avoids type-aware oxlint choking on root files like
 * `drizzle.config.ts` that live outside the tsconfig's include.
 */
export default {
  '*': () => ['bun run lint', 'bun run format'],
};
