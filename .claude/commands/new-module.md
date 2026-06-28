---
description: Scaffold a new NestJS domain module with the standard folder structure for this project.
---

The user will pass the module name as an argument (e.g. `/new-module bonus`).
Use that name (kebab-case for files, PascalCase for classes).

Create the following structure under `src/<name>/`:

```
src/<name>/
  <name>.module.ts          # @Module — wires controllers, providers, imports
  <name>.controller.ts      # Thin controller: routes + payload marshalling
  services/                 # <name>.service.ts — business logic (@Injectable)
  repos/                    # Custom TypeORM repositories (@Injectable)
  entity/                   # TypeORM entities
  dto/                      # Request/response DTOs (class-validator + swagger)
  enum/                     # Enums
```

Only create the folders you actually need now — add `guards/`, `handlers/`,
`subscribers/`, `validators/` later if the feature calls for them.

`<name>.module.ts` minimum shape:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/db/database.module';
// import the entity / service / repository / controller you create

@Module({
  imports: [DatabaseModule.forFeature([/* <Name>Entity */])],
  controllers: [/* <Name>Controller */],
  providers: [/* <Name>Service, <Name>Repository */],
  exports: [/* <Name>Service */],
})
export class <Name>Module {}
```

Then add `<Name>Module` to the `imports` array of
[`src/app.module.ts`](../../src/app.module.ts) — among the other domain modules
(`UsersModule`, `AuditModule`, `FileModule`, …), after the infrastructure
modules (`DatabaseModule.forRoot()`, `RedisModule`, `PaginationModule`,
`LoggerModule`, `HealthModule`).

Rules to follow:

- Services and repositories are decorated with `@Injectable()` from
  `@nestjs/common`. Repositories inject the entity repo with
  `@InjectRepository(<Name>Entity) private readonly repo: Repository<...>` and
  also inject `ContextLogger`.
- Services own logic; controllers stay thin (declarative routes + DTO
  marshalling). Guards (`JwtAuthGuard`, `RolesGuard`) are global — use
  `@Public()`, `@Roles(UserRole.ADMIN)`, `@CurrentUser()` as needed.
- For **paginated list endpoints**, the query DTO extends `PageOptionsDto`
  (`@/core/pagination/dto/page-options.dto`) and the repository calls
  `paginationFactory.paginate(queryBuilder, query)` — inject
  `PaginationFactory<Entity>`. See
  [`src/users/repos/users.repository.ts`](../../src/users/repos/users.repository.ts).
- **Entities** must follow the DB constraint-naming convention (enforced by the
  custom Oxlint plugin):
  - `@PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_<table>' })`
  - `@Index('<descriptive_columns>_index', ...)` — always name the index
  - `@JoinColumn({ foreignKeyConstraintName: 'FK_<source>_to_<target>' })`
  - `@Column({ type: 'enum', enumName: '<snake>_enum', enum: ... })` — always
    name the enum; reuse the same `enumName` everywhere a shared TS enum is used
  - Date columns use `@CreateDateColumn({ type: 'timestamptz' })` /
    `@UpdateDateColumn({ type: 'timestamptz' })`; string columns set `length`.
  - Add `@Auditable()` if entity changes should be tracked in the audit log.
  - DTO/entity fields use `@ApiProperty` / `@ApiPropertyOptional` from
    `@nestjs/swagger` and class-validator decorators.
- Use the `@/` path alias for cross-module imports; relative paths within the
  same module.
- Do **not** generate a migration yet — finish the entities first, then run
  `bun run mig:gen <Name>` at the end (see `/gen-migration`).
- Do **not** create gateways or queue handlers unless the user explicitly asks.

After scaffolding, tell the user:

1. Files created.
2. Next steps (finalize entity, register in `app.module.ts`, add routes,
   write tests, generate migration with `bun run mig:gen`).
