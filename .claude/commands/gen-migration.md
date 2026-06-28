---
description: Generate a TypeORM migration from entity changes, review it, then run it.
---

The user will pass a migration name as an argument
(e.g. `/gen-migration AddBonusRounds`).
If no name is provided, ask the user for one before proceeding.

Before generating: make sure the entity changes are complete and follow the DB
constraint-naming convention (explicit `PK_`/`FK_`/`..._index`/`..._enum` names,
`timestamptz` dates, column lengths) — otherwise the generated diff will be
noisy.

Run:

```
bun run mig:gen <Name>
```

This wrapper ([`scripts/migration-generate.sh`](../../scripts/migration-generate.sh)):

1. Converts `<Name>` to kebab-case and generates the migration into
   `src/infra/db/migrations/`.
2. Deduplicates shared enum types (TypeORM emits duplicates when an `enumName`
   is reused across entities).
3. Formats the file with oxfmt.
4. If there are **no real schema changes**, it deletes the phantom file and
   exits without creating a migration — report that to the user if it happens.

After generation:

1. Read the generated SQL migration from `src/infra/db/migrations/` and show it
   to the user for confirmation. Verify:
   - `up()` and `down()` are both correct and reversible.
   - Constraint names match the convention (`PK_`, `FK_x_to_y`, `..._index`,
     `..._enum`) — never TypeORM auto-generated hashes.
   - Date columns are `timestamptz`; no unexpected `DROP`/data-loss statements.
2. Apply it with:

   ```
   bun run mig:run
   ```

   To undo the last migration: `bun run mig:revert`.

3. Remind the user that production runs migrations via `bun run mig:run:prod`
   (against the built `dist/`).
