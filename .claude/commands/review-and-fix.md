---
description: Review staged/unstaged changes for correctness and project conventions, then run all four quality gates and fix any failures.
---

## Step 1 — Code review

Run `git diff HEAD` (or `git diff --cached` if changes are staged) and review the
diff against the rules in CLAUDE.md. Check for:

- **Architecture**: thin controllers/gateways, business logic lives in services,
  DB access goes through `@Injectable()` repositories (no raw queries in
  services/controllers).
- **New domain modules** not registered in
  [`src/app.module.ts`](../../src/app.module.ts), or entities not registered via
  `DatabaseModule.forFeature([...])`.
- **DB constraint naming** (enforced by the custom Oxlint plugin, but verify):
  explicit names on `@Index('..._index', ...)`,
  `@JoinColumn({ foreignKeyConstraintName: 'FK_x_to_y' })`,
  `@Column({ type: 'enum', enumName: '..._enum' })`,
  `@PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_x' })`.
  Date columns must be `timestamptz`; string columns must set `length`.
- **DTO/entity fields** missing `@ApiProperty` / `@ApiPropertyOptional` (from
  `@nestjs/swagger`) or missing class-validator decorators.
- Enum/union fields validated with `@IsString()` instead of `@IsEnum(...)` /
  proper decorator.
- Roles typed as `string` / `string[]` where they should be `UserRole` /
  `UserRole[]`.
- `console.log` instead of the injected `ContextLogger`
  (`@arkv/nestjs-context-logger`).
- Ad-hoc thrown errors where a standard Nest exception fits
  (`NotFoundException`, `BadRequestException`, `ForbiddenException`, …);
  literal HTTP status codes (`401`, `404`) where `HttpStatus.*` should be used.
- Password handling not using `Bun.password` via
  [`@/core/utils/password.util`](../../src/core/utils/password.util.ts)
  (never bcrypt).
- Paginated endpoints not using cursor pagination via `PaginationFactory`
  (no offset/page-number pagination).
- New env vars not added to `.env.example` **and** `.env` **and** the relevant
  DTO in `src/config/dto/`, or `bun run gen:env:docs` not regenerated.
- Secrets / sensitive fields that should be masked or excluded
  (e.g. `@Auditable({ exclude: ['password'] })`, `select: false` columns).

Report all issues found before making any fixes.

## Step 2 — Apply fixes

Fix every issue identified in Step 1. Explain each fix briefly as you apply it.

## Step 3 — Quality gates

Run the four gates in order and fix all failures:

```
bun run lint
bun test
bun run build
bun run typecheck
```

Iterate until all four pass. Then give a final summary of what was changed and
the gate results.
