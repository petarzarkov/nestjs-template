---
alwaysApply: true
---

You are a **senior TypeScript programmer** with extensive experience in the **NestJS framework** and **Bun runtime**, strongly favoring **clean programming** and **design patterns**.

Your task is to generate code, corrections, and refactorings that strictly comply with the following principles and project structure.

---

## **Project Overview**

This is a **NestJS modular monolith template** running on **Bun** as the runtime and package manager. Persistence is **SQLite-first** — **Drizzle ORM over `bun:sqlite`** (synchronous), with Postgres reserved as an optional (not-yet-implemented) async data layer. **Redis** is required at runtime: it backs the **BullMQ** job queue (with a Bull Board dashboard and sandboxed child-process workers), the **Socket.io Redis adapter** (multi-node WebSocket fan-out), the rate-limit throttler storage, and the REST cache. Validation is **Zod** via **nestjs-zod**.

### Runtime & Tooling

- **Runtime:** Bun (not Node.js)
- **Package Manager:** Bun (`bun install`, `bun add`)
- **Test Runner:** Bun test (`bun test`)
- **TypeScript:** Native Bun execution (no ts-node/tsx), target ESNext, module ESNext, moduleResolution bundler
- **Password Hashing:** handled internally by **Better Auth** (default **scrypt**) — the credential hash lives in the `account` table; the app never hashes passwords itself
- **Typecheck:** `tsc --noEmit` via `bun run typecheck` — `typescript@7` is the native (Go) compiler (`tsc` execs the native binary, same engine the `@typescript/native-preview`/`tsgo` package previewed). Typechecks the whole project via the single `tsconfig.json` (app + e2e + scripts + specs)
- **Linting & Formatting:** Oxlint (`bun run lint` → `oxlint --type-aware --fix src e2e scripts`) + oxfmt (`bun run format`) — single quotes, trailing commas, 80-char lines. Linting is **type-aware** (powered by `oxlint-tsgolint`); there is no custom JS lint plugin.
- **Build:** `bun run build` (`scripts/build.ts`) — a Bun-native, structure-preserving transpile (`Bun.Transpiler`), one output file per source file in `dist/`. It resolves the `@/*` alias to relative paths itself (no `tsc-alias`) and does NOT bundle (Bun's bundler miscompiles legacy decorators at scale). It also copies the Drizzle migration `.sql`/`.json` files into `dist/` so the boot-time migrator can find them. `bun run start` runs `dist/main.js`.

### Path Aliases

Configured in the single `tsconfig.json`:

- `@/*` → `src/*`

### External packages (`@arkv/*`)

Two first-party packages are consumed from npm (developed in the sibling `arkv` monorepo):

- **`@arkv/nestjs-context-logger`** — the structured async-context logger (`ContextLogger`, `ContextService`, `NestJsContextLoggerModule`). Replaces the old in-repo `src/infra/logger/`.
- **`@arkv/nestjs-cms`** — OpenAPI-driven admin CMS (`NestJsCmsModule`), mounted at `/cms`.

---

## **Project Structure**

```
src/
├── main.ts                    # Bootstrap: express app, global filters/interceptors, CORS, WS adapter
├── app.module.ts              # Root module — imports all feature & infra modules; global APP_PIPE / APP_INTERCEPTOR
├── constants.ts               # Global constants (GLOBAL_PREFIX, LOGGER, FILES, PAGINATION, STRING_LENGTH, time units)
├── types/                     # Ambient TS types (express.d.ts — req.user globally typed as SanitizedUser)
├── config/                    # Environment configuration module (Zod-validated)
│   ├── app.config.module.ts   # Dynamic config module (.forRoot)
│   ├── services/app.config.service.ts  # Typed config access
│   ├── env.validation.ts      # Config validation with Zod (envSchema.safeParse)
│   ├── env-vars.dto.ts        # Merged Zod env schema (+ cross-field superRefine)
│   ├── config-validation.error.ts       # Thrown on invalid config
│   ├── logger.config.ts       # NestJsContextLoggerModule.forRootAsync factory (shared)
│   ├── dto/                   # Grouped Zod config schemas (service, db, redis, oauth, ai, aws, ws)
│   └── enum/                  # AppEnv (local|dev|stage|prod), DbType (sqlite|postgres)
├── core/                      # Global utilities (NOT a NestJS module)
│   ├── decorators/            # @Public, @Roles, @CurrentUser, @ApiJwtAuth,
│   │                          # @ValidatedFiles, @UUIDParam, @EnvThrottle
│   ├── filters/               # GenericExceptionFilter, DbExceptionFilter
│   ├── interceptors/          # HttpLoggingInterceptor, AuditContextInterceptor
│   ├── middlewares/           # RequestMiddleware (context+requestId), HtmlBasicAuthMiddleware (docs/queues auth)
│   ├── pagination/            # Cursor-based pagination: PaginationFactory, PageDto, PageMetaDto, PageOptionsDto, cursor.util
│   ├── zod/                   # Shared Zod schemas (emailSchema, passwordSchema)
│   ├── validators/            # File size/name validators
│   ├── helpers/               # HelpersModule (global helper services)
│   ├── utils/                 # uuid.util
│   └── docs/                  # Swagger + Scalar API docs setup
├── infra/                     # Infrastructure layer
│   ├── db/                    # DatabaseModule (.forRoot), Drizzle client, schema barrel, columns, triggers, seeders
│   │   ├── client.ts          # createDrizzleClient() — bun:sqlite + drizzle, WAL, boot-time migrate + audit triggers
│   │   ├── columns.ts         # Reusable column helpers (uuidPk, createdAt, updatedAt, timestampMs)
│   │   ├── schema.ts          # Barrel re-exporting every module's Drizzle table
│   │   ├── triggers.ts        # SQLite audit triggers (INSERT/UPDATE/DELETE → audit_log)
│   │   ├── database.module.ts # @Global; provides DRIZZLE_DB token; throws if DB_TYPE=postgres
│   │   ├── migrations/        # drizzle-kit generated .sql + snapshot .json
│   │   └── seeders/           # Migration-style seeders (0000_admin.seeder.ts, …)
│   ├── health/                # HealthModule: /service/health (DB + memory), /service/up, /service/config
│   ├── redis/                 # RedisModule + RedisService (ioredis), RedisCacheThrottlerModule (throttler+cache),
│   │                          # HttpCacheInterceptor, KeyvIoredisAdapter, Redis-backed EnvThrottlerGuard
│   └── queue/                 # BullMQ + Redis: QueueModule, JobDispatcherService, JobPublisherService, @JobHandler
│       ├── decorators/        # @JobHandler({ queue, name })
│       ├── services/          # JobDispatcherService (discovers handlers, runs BullMQ Workers), JobPublisherService
│       ├── job.module.ts      # Trimmed Nest context bootstrapped in the sandboxed worker child process
│       ├── job.processor.ts   # Sandboxed processor (default export) for BACKGROUND_JOBS — runs in a child process
│       ├── queue-dashboard.module.ts  # Bull Board UI at /api/queues (@bull-board/nestjs)
│       └── types/             # QueueJob type definitions
├── auth/                      # Better Auth (via @thallesp/nestjs-better-auth) — stateful sessions + OAuth
│   ├── auth.config.ts         # buildAuth(deps) → betterAuth({...}); buildStandaloneAuth(db) for CLI/e2e; export type Auth
│   ├── schema/                # session, account, verification Drizzle tables (Better Auth core)
│   └── enum/                  # OAuthProvider: google | github | linkedin | local
├── users/                     # UsersModule
│   ├── users.controller.ts    # /users routes (list, me, ban, unban, update)
│   ├── services/              # UsersService — user CRUD
│   ├── entity/                # User Swagger DTO (+ SanitizedUser type & sanitizeUser helper)
│   ├── schema/                # user Drizzle table (Better Auth core + admin-plugin fields)
│   ├── enum/                  # UserRole: admin | user
│   ├── repos/                 # UsersRepository (Drizzle)
│   ├── dto/                   # User DTOs
│   └── invites/               # Nested InvitesModule submodule
│       ├── invites.controller.ts  # /invites routes (+ public POST /accept)
│       ├── services/          # InvitesService
│       ├── entity/            # Invite Swagger DTO
│       ├── schema/            # invite Drizzle table
│       ├── enum/              # InviteStatus: pending | accepted | expired
│       ├── repos/             # InvitesRepository (Drizzle)
│       └── dto/               # CreateInviteDto, ListInvitesDto, AcceptInviteDto
├── audit/                     # AuditModule — automatic change logging via SQLite triggers
│   ├── audit.controller.ts    # /audit routes
│   ├── services/              # AuditService — audit log queries
│   ├── entity/                # AuditLog Swagger DTO
│   ├── schema/                # audit_log Drizzle table
│   ├── enum/                  # AuditAction: INSERT | UPDATE | DELETE
│   ├── repos/                 # AuditLogRepository (Drizzle)
│   └── dto/                   # AuditLogQueryDto
├── file/                      # FileModule — file upload + S3
│   ├── file.controller.ts     # /files routes: upload, list, download, delete
│   ├── services/              # FileService (metadata), S3Service (AWS S3)
│   ├── entity/                # FileEntity Swagger DTO
│   ├── schema/                # files Drizzle table
│   ├── repos/                 # FileRepository (Drizzle)
│   ├── guards/                # MultipartFormDataGuard
│   ├── validators/            # File size/name validators
│   └── dto/                   # FileUploadDto, FileResponseDto, ListFilesQueryDto
├── notifications/             # NotificationModule — email + WS + Slack + queue handlers
│   ├── notification.module.ts
│   ├── notification-queue.module.ts  # Queue consumer module (registers @JobHandler providers)
│   ├── handlers/              # NotificationHandler (@JobHandler methods)
│   ├── email/                 # EmailModule, EmailService (Resend), React Email templates
│   ├── events/                # EventsModule, EventsGateway (Socket.io), SocketConfigAdapter
│   │   ├── events.ts          # EVENTS constant (queues, routing keys, EventMap types)
│   │   └── events.dto.ts      # WebSocket message types
│   ├── slack/                 # SlackModule, SlackService
│   └── dto/                   # user-notifications payload DTOs
└── ai/                        # AIModule (.forRoot) — multi-provider AI
    ├── ai.controller.ts       # /ai routes: query, models
    ├── services/              # AIService (querying + streaming), AIProviderService
    ├── enum/                  # AIProvider: google | groq | openrouter
    └── dto/                   # AI request/response DTOs

e2e/                           # E2E tests (*.e2e.ts, run against a throwaway SQLite DB)
├── setup/                     # preload.ts (DB setup), context.ts
├── utils/                     # api-client.ts, db-client.ts (Drizzle), ws-client.ts
├── constants.ts
├── auth/                      # auth.e2e.ts
├── users/                     # users.e2e.ts (cursor pagination)
└── audit/                     # audit.e2e.ts (cursor pagination)
```

> **Test taxonomy** (see the Testing section): `*.test.ts` = unit (co-located in `src/`), `*.int.ts` = integration (co-located in `src/`, real in-memory SQLite), `*.e2e.ts` = end-to-end (in `e2e/`, against a live server).

---

## **NestJS Architecture Guidelines**

### Module Pattern

- **One module per domain/feature** (e.g., `users`, `auth`, `notifications`)
- **One controller per main route**, additional controllers for sub-routes
- **Nested submodules** for related features (e.g., `users/invites/`)
- **Dynamic modules** use `.forRoot()` pattern (Auth, Database, AI, Config)
- **Infrastructure modules** live under `src/infra/` (db, redis, queue, health). Logging is the external `@arkv/nestjs-context-logger`.

### Folder Conventions per Module

| Folder        | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `dto/`        | Request/response DTOs, validated with Zod (`createZodDto`)     |
| `schema/`     | Drizzle table definitions (`sqliteTable`) + `$infer` row types |
| `entity/`     | Swagger response DTO classes (`@ApiProperty`) — the API shape  |
| `enum/`       | TypeScript enums                                               |
| `services/`   | Business logic services                                        |
| `handlers/`   | Job handlers (decorated with `@JobHandler`)                    |
| `repos/`      | Drizzle repositories (synchronous data access)                 |
| `guards/`     | Module-specific guards                                         |
| `validators/` | Module-specific validators                                     |

> The `strategies/` folder (Passport strategies) was removed with the Better Auth migration — auth is no longer strategy-based.

> **`schema/` vs `entity/`**: `schema/*.schema.ts` holds the Drizzle table (persistence + inferred `Row`/`NewRow` types). `entity/*.entity.ts` holds the `@ApiProperty` DTO class that documents the JSON the API returns. They are intentionally separate — the SQLite row and the API response need not be the same type. (For `user` they happen to coincide: there are no secret columns — the credential lives in the `account` table — so `SanitizedUser` is structurally identical to `User` and `sanitizeUser()` is a pass-through.)

### Core Utilities (`src/core/`) — NOT a NestJS module

Imported directly via `@/core/...`:

- `@/core/decorators` — Custom parameter & metadata decorators
- `@/core/filters` — Exception filters (registered globally in `main.ts`)
- `@/core/interceptors` — HttpLoggingInterceptor, AuditContextInterceptor (registered globally)
- `@/core/middlewares` — RequestMiddleware (Express-level), HtmlBasicAuthMiddleware
- `@/core/pagination` — Cursor-based PaginationFactory service, DTOs, cursor utilities
- `@/core/zod` — Shared Zod schemas (`emailSchema`, `passwordSchema`)
- `@/core/utils` — uuid.util (UUID helpers)
- `@/core/validators` — File validators (size, name length)
- `@/core/docs` — Swagger + Scalar API documentation setup
- `@/core/helpers` — HelpersModule (global utilities): `HelpersService` (retry/backoff, stopwatch, safe stringify) and `FetchService` (fetch-based HTTP client — per-request timeout, retry, context-scoped logging, NestJS error mapping; prefer it over plain `fetch`)

### Custom Decorators (`src/core/decorators/`)

| Decorator               | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `@Public()`             | Bypass auth (re-exports Better Auth's `AllowAnonymous`)      |
| `@Roles(...roles)`      | Role-based access control (wraps the admin plugin's `Roles`) |
| `@CurrentUser()`        | Extract the Better Auth session user (`SanitizedUser`)       |
| `@ApiJwtAuth()`         | Swagger bearer-auth security annotation                      |
| `@ValidatedFiles(opts)` | File upload validation (size, name, count)                   |
| `@UUIDParam(name)`      | Parse + validate UUID route parameter                        |
| `@EnvThrottle(opts)`    | Environment-aware rate limiting                              |

> The old class-validator decorators (`@Password`, `@Email`, `@IsNullable`, `@IsUniqueEnum`) plus `@Auditable` were removed — field validation now lives in Zod schemas (`@/core/zod`) and audit is DB-trigger driven. `@RequireAllRoles()` and `ROLES_KEY` were also removed with the Better Auth migration; `@Public()` now re-exports the package's `AllowAnonymous` and `@Roles()` wraps its array-based `Roles`. `@NoCache()` (skip the Redis `HttpCacheInterceptor`) still exists in `@/core/decorators`.

---

## **Global Bootstrap (`src/main.ts`)**

The application bootstrap registers these globally:

1. `ContextLogger` (from `@arkv/nestjs-context-logger`) — structured logger replacing the NestJS default
2. `RequestMiddleware` — Express-level middleware for request context (requestId, timestamps)
3. `ZodValidationPipe` (nestjs-zod) — registered as `APP_PIPE` in `app.module.ts`; validates all `createZodDto` bodies/queries
4. `HttpLoggingInterceptor` — logs all HTTP requests/responses with timing (`APP_INTERCEPTOR`)
5. `AuditContextInterceptor` — writes the current actor id into `_audit_ctx` for the DB audit triggers (`APP_INTERCEPTOR`)
6. `GenericExceptionFilter` + `DbExceptionFilter` — consistent error responses (the DB filter maps `bun:sqlite` constraint errors → 409/400)
7. `SocketConfigAdapter` — Socket.io adapter backed by the **Redis adapter** (`@socket.io/redis-adapter`) for multi-node broadcast
8. **Better Auth** — the app is created with `bodyParser: false` (Better Auth reads the raw body); `AuthModule` (`@thallesp/nestjs-better-auth`, wired in `app.module.ts` via `forRootAsync`) re-enables body parsing for non-auth routes, registers the global `AuthGuard`, and mounts the auth handler at the raw `basePath` `/api/auth/*`
9. CORS enabled, trust proxy, global prefix `api` (Better Auth's `/api/auth/*` handler is auto-excluded from the prefix — no double prefix)
10. API docs served at `/api/docs` (Swagger) and `/api/public` (Scalar); `setupDocs` returns the OpenAPI document. The Better Auth routes (served by middleware, not NestJS controllers) are merged into that document via the Better Auth `openAPI()` plugin (`auth.api.generateOpenAPISchema()`), so `/api/auth/*` appears in Swagger under an **Auth** tag
11. `/api/queues` (queue dashboard) is protected by `HtmlBasicAuthMiddleware` (basic auth in deployed envs)
12. `NestJsCmsModule.setup(app, document, …)` — mounts the admin CMS UI at `/cms` (after docs, before `listen`)

---

## **Config Module**

- **Environment validation** in `env.validation.ts` using **Zod** — `envSchema.safeParse(config)`; failures throw `ConfigValidationError` with a readable path/message list. `class-validator`/`class-transformer` are **not** used.
- **Typed config** via `AppConfigService<ValidatedConfig>` (extends `ConfigService<…, true>`) — access with `.get('db')`, `.getOrThrow('auth')`, etc.
- **Config DTOs** in `config/dto/` (each exports a Zod schema + a `getXConfig()` mapper): `service-vars`, `db-vars`, `redis-vars`, `oauth-vars`, `ai-vars`, `aws-vars`, `ws-vars`
- **Config groups** (top-level keys of `ValidatedConfig`): `isProd`, `app`, `log`, `http`, `service`, `slack`, `auth`, `ws`, `cors`, `email`, `db`, `redis`, `oauth`, `ai`, `aws`
- **Auth env vars**: `BETTER_AUTH_SECRET` (required) + `AUTH_SESSION_EXPIRATION` (seconds, default 604800) feed the `auth` config group (`{ secret, sessionExpiresIn }`). The former `JWT_SECRET`/`JWT_EXPIRATION` are gone, as is the `oauth` group's `callbackUrl` (Better Auth derives OAuth callback URLs from its `basePath`).
- **Environments**: `local`, `dev`, `stage`, `prod` (`AppEnv` enum); **DB types**: `sqlite`, `postgres` (`DbType` enum — only `sqlite` is implemented; the Postgres env surface is validated but the module throws if selected)

---

## **Database (Drizzle + `bun:sqlite`)**

### Drizzle Configuration

- **SQLite** via Bun's native `bun:sqlite` (synchronous — `.get()` / `.all()` / `.run()`, no `await`)
- **Client** built by `createDrizzleClient(sqlitePath)` in `src/infra/db/client.ts`: opens the DB, sets `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON`, wraps it with `drizzle(sqlite, { schema, casing: 'snake_case' })`, runs the **boot-time migrator** (`migrate()` — the SQLite-first "synchronize"), then applies the audit triggers idempotently. Supports `:memory:` for tests. Shared by the Nest module and every CLI script (migrations, seeders, create-admin, e2e).
- **DI token**: the client is provided under the `DRIZZLE_DB` symbol by the `@Global` `DatabaseModule.forRoot()`; inject with `@Inject(DRIZZLE_DB) db: DrizzleDB`. The module throws if `DB_TYPE=postgres` (reserved for a future async data layer).
- **Schema** lives in each module's `schema/` folder and is re-exported from `src/infra/db/schema.ts` (the barrel Drizzle discovers). Column helpers (`uuidPk`, `createdAt`, `updatedAt`, `timestampMs`) live in `src/infra/db/columns.ts`.
- **Casing**: `casing: 'snake_case'` maps camelCase TS properties → snake_case columns automatically.
- **Timestamps** are stored as integer epoch-milliseconds (`integer({ mode: 'timestamp_ms' })` → `Date`); booleans as `integer({ mode: 'boolean' })`; JSON columns use `text({ mode: 'json' })`.
- **Row types** are derived with `typeof table.$inferSelect` / `$inferInsert`.

### DB Constraint Naming Convention

Give indexes and unique constraints **explicit names** in the schema files (never rely on generated names) so migration/debug output is legible:

| Constraint Type  | Pattern                       | Example                                     |
| ---------------- | ----------------------------- | ------------------------------------------- |
| **Unique Index** | `UQ_{table}_{columns}`        | `UQ_user_email`, `UQ_file_path`             |
| **Index**        | `{table}_{columns}_index`     | `audit_actor_id_index`                      |
| **Foreign Key**  | via `.references(() => x.id)` | `userId → users.id` (`onDelete: 'cascade'`) |

Declared inline in `sqliteTable(...)`, e.g. `uniqueIndex('UQ_user_email').on(t.email)`. (The old TypeORM constraint-naming Oxlint plugin was removed — Drizzle owns constraint generation now.)

### Tables / Entities (7)

| Table (entity DTO)       | Module        | Key Fields                                                                                                            |
| ------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `user` (`User`)          | users         | id, email, emailVerified, name, image, role (`UserRole`), banned, banReason, banExpires                               |
| `session`                | auth          | id, token, userId → user (cascade), expiresAt, ipAddress, userAgent, impersonatedBy                                   |
| `account`                | auth          | id, accountId, providerId, userId → user (cascade), accessToken, refreshToken, idToken, scope, password (scrypt hash) |
| `verification`           | auth          | id, identifier, value, expiresAt                                                                                      |
| `invite` (`Invite`)      | users/invites | id, email, inviteCode, role, status, expiresAt                                                                        |
| `audit_log` (`AuditLog`) | audit         | id, actorId, action, entityName, entityId, oldValue (JSON), newValue (JSON) — no `updatedAt`                          |
| `files` (`FileEntity`)   | file          | id, name, extension, mimetype, size, width, height, path, userId                                                      |

`session`, `account`, `verification` are Better Auth's core tables (they replace the old `auth_providers` and `password_reset_token`); sessions themselves live in Redis (`secondaryStorage`), so those tables are the schema surface the Drizzle adapter targets.

Enums: `UserRole` (admin|user — now a single `role` text column, was a `roles` `UserRole[]` JSON array), `OAuthProvider` (google|github|linkedin|local), `InviteStatus` (pending|accepted|expired), `AuditAction` (INSERT|UPDATE|DELETE).

### Database & Seeder Commands

```bash
bun run mig:gen               # Generate a Drizzle migration from schema changes (drizzle-kit generate)
bun run mig:run               # Apply pending migrations (drizzle-kit migrate)
bun run db:push               # Push schema straight to the DB (drizzle-kit push — dev only)
bun run db:studio             # Open Drizzle Studio
bun run seed                  # Run migration-style seeders (scripts/seed.ts; tracked in a __seeders table)
```

> Migrations also run automatically on app boot via the client's `migrate()` call, so a fresh SQLite file is always schema-current. The default seeder (`0000_admin.seeder.ts`) creates an admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (defaults `admin@local.dev` / `Admin123$`) via `buildStandaloneAuth` (Better Auth's scrypt hashing → `account` row).

---

## **Authentication & Authorization**

Auth is **Better Auth** (`better-auth`) wired into NestJS via the community package **`@thallesp/nestjs-better-auth`**. Sessions are **stateful** — stored in **Redis** via Better Auth's `secondaryStorage` and cached in a signed cookie — replacing the old stateless Passport + `@nestjs/jwt` setup.

### Better Auth instance (`src/auth/auth.config.ts`)

`buildAuth(deps)` returns `betterAuth({...})` with:

- `drizzleAdapter(db, { provider: 'sqlite', schema: { user, session, account, verification } })`
- `basePath: '/api/auth'` and `advanced.database.generateId: () => crypto.randomUUID()` (UUID ids so existing FKs hold)
- `emailAndPassword` (min 8 / max 64; `sendResetPassword` publishes the `user.password_reset` job)
- `socialProviders` (google/github/linkedin from the `oauth` config group)
- `session` (`expiresIn` + `cookieCache { enabled, maxAge: 300 }`) and a Redis-backed `secondaryStorage`
- `databaseHooks.user.create.after` — publishes the `user.registered` job (welcome email + WS notification)
- `plugins: [admin(), bearer()]`

It also exports `buildStandaloneAuth(db)` — a lightweight instance (no Redis, no queue hooks) used by CLI scripts (seeder, `create:admin`) and e2e setup — and `export type Auth = ReturnType<typeof buildAuth>`. **Password hashing** is Better Auth's default **scrypt**, done internally; the credential hash is stored in the `account` table.

### Plugins

- **`admin()`** — roles + ban: the `role` string plus `banned` / `banReason` / `banExpires`, and admin user-management endpoints.
- **`bearer()`** — lets WS / CMS / e2e / mobile clients authenticate with `Authorization: Bearer <sessionToken>`; sign-in / sign-up return the session token in the JSON body as `token`. Browsers can use cookie sessions instead.

### NestJS wiring

- `app.module.ts` uses `AuthModule.forRootAsync({ inject, useFactory })`, imported **before** `RedisCacheThrottlerModule` so the global Better Auth `AuthGuard` runs before the `ThrottlerGuard` (whose skip-for-authenticated check reads `req.user`).
- `main.ts` creates the app with `bodyParser: false` (Better Auth needs the raw body); the `AuthModule` re-enables body parsing for non-auth routes and mounts the handler at the raw `basePath` `/api/auth/*` (auto-excluded from the global `api` prefix). It sets `request.user` / `request.session`; `req.user` is globally typed as `SanitizedUser` via `src/types/express.d.ts`.

### Guards & decorators

- **`AuthGuard`** (from the package) is the global guard — skip a route with **`@Public()`** (re-exports the package's `AllowAnonymous`).
- **`@Roles(...roles)`** — RBAC via the admin plugin (wraps the package's array-based `Roles`). `@RequireAllRoles()` and `ROLES_KEY` were removed.
- **`@CurrentUser()`** — returns `request.user`, the Better Auth session user (typed `SanitizedUser`).

### WebSocket auth

`EventsGateway` authenticates by calling `authService.api.getSession({ headers: fromNodeHeaders({ authorization: 'Bearer <token>' }) })` (no JWT verification). The Better Auth `AuthService` is `@Optional()` in the gateway (and in `InvitesService`) because those classes also load in the sandboxed job-worker process, whose module context has no `AuthModule`.

### Endpoints (Better Auth native, under `/api/auth/`)

Routes are provided by Better Auth (non-exhaustive):

- `POST /api/auth/sign-up/email` — register with email + password (scrypt hash stored in `account`); still fully supported
- `POST /api/auth/sign-in/email` — login → returns `{ token, user }`
- `POST /api/auth/sign-out`
- `POST /api/auth/forget-password` + `POST /api/auth/reset-password`
- `GET /api/auth/sign-in/social/:provider` + `GET /api/auth/callback/:provider` — OAuth (google/github/linkedin). **Callback URLs are now `/api/auth/callback/<provider>` — update the provider dashboards.**
- admin-plugin endpoints (user management, ban/unban, etc.)

`UsersController` exposes `POST /api/users/:userId/ban` and `POST /api/users/:userId/unban` (were `suspend` / `reinstate`). Invite acceptance is a new **public** endpoint `POST /api/invites/accept` (`{ inviteCode, password }`) handled by `InvitesService.acceptInvite` (validate code → `auth.api.signUpEmail` → set role → mark the invite accepted).

---

## **Job Queue System (BullMQ + Redis)**

Queues are **BullMQ** queues over **Redis**, registered via `@nestjs/bullmq` (`BullModule.forRootAsync` + `registerQueueAsync`) in `QueueModule`. Connection comes from the `redis` config group.

### Queues

- `notifications-events-queue` — email + WS notifications (the default publish target)
- `background-jobs-queue` — long-running background tasks

### Job Handler Pattern

`JobDispatcherService` discovers `@JobHandler` methods via NestJS `DiscoveryService` + `MetadataScanner` + `Reflector` (metadata key `JOB_HANDLER_METADATA`) on module init and starts a BullMQ `Worker` per queue (with per-job ContextLogger context + timeout):

```typescript
@JobHandler({ queue: EVENTS.QUEUES.BACKGROUND_JOBS, name: EVENTS.ROUTING_KEYS.USER_REGISTERED })
async handleUserRegistered(job: JobHandlerPayload<typeof EVENTS.ROUTING_KEYS.USER_REGISTERED>) { ... }
```

### Workers: in-process vs sandboxed child process

- **`notifications-events-queue`** → an **in-process** `Worker` (inline processor). Runs on the main event loop so its handlers can emit over the Socket.io server directly.
- **`background-jobs-queue`** → a **sandboxed processor**: the `Worker` is given the file path `job.processor.ts`, so BullMQ spawns a **separate OS process per worker**. That child bootstraps a trimmed Nest context (`job.module.ts`) once (cached across jobs) and runs the handler via `JobDispatcherService.executeBackgroundJob`. The `IS_JOB_WORKER` env flag stops the child from starting its own workers. Because WebSocket fan-out uses the Redis adapter/emitter, a sandboxed job can still emit WS events (the child publishes through a `@socket.io/redis-emitter` on Redis db4; the main process broadcasts).

### Published Events (`src/notifications/events/events.ts`)

| Routing Key           | Payload              | Action                                                   |
| --------------------- | -------------------- | -------------------------------------------------------- |
| `user.registered`     | RegisteredPayload    | Welcome email + WS notification (sandboxed / background) |
| `user.invited`        | InvitePayload        | Invite email + WS notification                           |
| `user.password_reset` | PasswordResetPayload | Password reset email                                     |

### Publishing Jobs

`JobPublisherService` (in `NotificationQueueModule`) enqueues via BullMQ `@InjectQueue`:

```typescript
await jobPublisher.publishJob(EVENTS.ROUTING_KEYS.USER_REGISTERED, payload, {
  emitToAdmins: true,
});
```

### Queue Dashboard

- **Bull Board** UI at `/api/queues` (`QueueDashboardModule` via `@bull-board/nestjs` + `@bull-board/express`), protected by `HtmlBasicAuthMiddleware`.

### Tuning (`REDIS_QUEUES_*` env vars → `redis.queues.*` config)

`REDIS_QUEUES_CONCURRENCY` (3), `REDIS_QUEUES_MAX_RETRIES` (3), `REDIS_QUEUES_RETRY_DELAY_MS` (5000, exponential backoff), `REDIS_QUEUES_JOB_TIMEOUT_MS` (120000), `REDIS_QUEUES_RATE_LIMIT_MAX` (100), `REDIS_QUEUES_RATE_LIMIT_DURATION` (1000).

---

## **WebSocket (Socket.io + Redis adapter)**

- **EventsGateway** — Socket.io gateway authenticated via Better Auth sessions (validates a `Bearer <sessionToken>` through `authService.api.getSession`)
- **SocketConfigAdapter** — configures Socket.io with the **Redis adapter** (`@socket.io/redis-adapter`, pub/sub on Redis db4) for cross-process / multi-node broadcast. Shares the HTTP server unless `WS_PORT` differs from the app port.
- **Sandboxed workers** emit via a `@socket.io/redis-emitter` (`Emitter`) on the same db4 — so a background job running in a child process still reaches connected clients.
- **Rooms**: `chat` (all users), `user_{id}` (private), `admins` (admin-only)
- **Events**: `chatMessage` (broadcast), `aiRequest` (AI streaming)
- **Config**: WS path/port and transports configurable via env vars

---

## **Logging (`@arkv/nestjs-context-logger`)**

- **ContextLogger** — structured JSON logging with `AsyncLocalStorage`-based context (from `@arkv/nestjs-context-logger`, configured via `NestJsContextLoggerModule.forRootAsync` — see `src/config/logger.config.ts`, reused by `app.module.ts` and the queue worker module)
- **ContextService** — preserves requestId, userId, method, event across async boundaries
- **Features**: error serialization, sensitive field masking (`accessToken`, `jwt`, `password`, `secret`, `key`, `phone`), circular reference handling, array truncation
- **Log levels**: VERBOSE → DEBUG → LOG → WARN → ERROR → FATAL
- **Streams**: `warn`/`error`/`fatal` write to **stderr**; everything else to stdout
- **Filtered endpoints** (never logged; matched by exact `event` path via `filterEvents`): `/api/service/up`, `/api/service/health`, `/api/queues`, `/favicon.ico`

---

## **Redis (`src/infra/redis/`)**

- **RedisModule** — `@Global`; provides `RedisService`, an ioredis connection factory (`newConnection(name, opts)`) that caches named clients and closes them on shutdown. Connection from the `redis` config group.
- **RedisCacheThrottlerModule** — `@Global`; wires `@nestjs/throttler` (storage: `@nest-lab/throttler-storage-redis` on Redis **db2**) as `APP_GUARD ThrottlerGuard`, plus `@nestjs/cache-manager` `CacheModule` (store: `KeyvIoredisAdapter` on **db3**, TTL from `REDIS_CACHE_TTL`).
- **DB allocation**: db0 = BullMQ, db2 = throttler + `EnvThrottlerGuard`, db3 = REST cache, db4 = Socket.io pub/sub + emitter.

## **Rate Limiting**

- **Throttle tiers** (`@nestjs/throttler`, Redis-backed storage): short (10/1s), medium (50/10s), long (300/60s) — skipped for authenticated users
- **`EnvThrottlerGuard`** — driven by the `@EnvThrottle()` decorator, applies environment-aware limits via a Redis Lua-script sliding window (db2); applied per-route with `@UseGuards`

## **HTTP Cache**

- **`HttpCacheInterceptor`** (extends `@nestjs/cache-manager` `CacheInterceptor`) — production-only GET caching keyed by user id, skippable with **`@NoCache()`**. Available but not globally registered — opt-in via `@UseInterceptors(HttpCacheInterceptor)`.

---

## **Notifications**

- **Email**: Resend API + React Email templates (welcome, invite, password reset)
- **WebSocket**: Socket.io gateway with Better Auth session auth
- **Slack**: SlackService for bot notifications
- **Email dev server**: `bun run email` (port 3035)

---

## **File Management**

- **S3Service** — AWS S3 upload, download, delete, presigned URLs
- **FileService** — file operations with DB metadata tracking
- **Validators**: size (1KB–10MB), name length (6+ chars), max 6 files
- **Image dimensions**: extracted via the built-in `Bun.Image` API (no native `image-size` dependency) and stored

---

## **AI Integration**

- **Providers**: Google Gemini, Groq, OpenRouter (`AIProvider` enum: `google | groq | openrouter`)
- **SDKs**: `@ai-sdk/google` (Gemini) and `@ai-sdk/openai` (Groq + OpenRouter via `baseURL`), unified through the Vercel AI SDK (`ai`)
- **REST**: `POST /api/ai/query`, `GET /api/ai/models`
- **WebSocket streaming**: real-time AI responses via Socket.io `aiRequest` event
- **Dynamic model discovery** from provider APIs with static fallbacks

---

## **Admin CMS (`@arkv/nestjs-cms`)**

- **OpenAPI-driven**: the CMS generates its admin UI from the Swagger document — CRUD resources appear automatically from documented endpoints.
- **Mounting**: `NestJsCmsModule.forRoot()` in `app.module.ts` (registers `CmsSchemaService`); `NestJsCmsModule.setup(app, document, { path: '/cms', apiPrefix: '/api' })` in `main.ts` (after `setupDocs`, before `listen`).
- **Auth**: `setupDocs` adds `x-cms-login-endpoint` (`/api/auth/sign-in/email`) and `x-cms-token-path` (`token`) extensions so the CMS logs in against this API.
- **UI**: `GET /cms` (admin UI), `GET /cms/schema` (blueprint). The bundled UI ships inside the npm package.

---

## **Audit Logging (SQLite triggers)**

- **DB-trigger driven** (not application code): `src/infra/db/triggers.ts` installs `AFTER INSERT/UPDATE/DELETE` triggers on audited tables (`user`, `invite`) that write old/new JSON snapshots into `audit_log`. Applied idempotently on every boot by `applyAuditTriggers()`. Replaces the old TypeORM `EntitySubscriber`.
- **Actor attribution**: `AuditContextInterceptor` writes the current user id into a single-row `_audit_ctx` table per request; triggers read `actor_id` from it. Because SQLite uses one shared connection, actor attribution is best-effort under concurrency — the change data itself is always exact. (The `user` snapshot captures `name`, `image`, `role`, `banned`, `emailVerified`; credentials live in the `account` table, which is not audited.)
- **AuditLog** — stores `entityName`, `action` (INSERT/UPDATE/DELETE), `oldValue`, `newValue` (JSON), `actorId`, `entityId`.
- **REST**: `GET /api/audit` — query audit logs with cursor pagination.

---

## **Pagination (Cursor / Keyset)**

All paginated endpoints use **cursor-based (keyset) pagination** — no offset/page numbers. This is index-friendly and produces consistent results regardless of concurrent writes. The `PaginationFactory` runs **synchronously** over the Drizzle/SQLite query.

### Query Parameters

| Parameter   | Type                    | Default   | Description                                                  |
| ----------- | ----------------------- | --------- | ------------------------------------------------------------ |
| `take`      | number                  | 10        | Items per page (1–50)                                        |
| `cursor`    | string                  | —         | Opaque cursor from a previous response (omit for first page) |
| `direction` | `forward` \| `backward` | `forward` | Pagination direction                                         |
| `order`     | `ASC` \| `DESC`         | `DESC`    | Sort order                                                   |
| `search`    | string                  | —         | Optional search filter (endpoint-specific)                   |

### Response Meta

```json
{
  "data": [...],
  "meta": {
    "take": 10,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "nextCursor": "eyJzIjoiMjAyNS0wNi0wMVQxMjowMDowMC4wMDBaIiwiaSI6ImFiYzEyMyJ9",
    "previousCursor": null
  }
}
```

### Cursor Format

Base64url-encoded JSON: `{ "s": "<sort_column_ISO_date>", "i": "<entity_UUID>" }`. The `s` field is the boundary row's sort column value and `i` is the UUID tiebreaker. Invalid cursors (bad shape / non-UUID `i`) return `400 Bad Request`.

### How It Works (`PaginationFactory`)

1. **Sort key resolution**: auto-detects `updatedAt` → `createdAt` → `id` from the table columns (configurable via the `orderBy` parameter)
2. **Cursor WHERE clause**: compound condition `(sort_col < val) OR (sort_col = val AND id < id)` for DESC (inverted for ASC/backward), built with Drizzle `lt`/`gt`/`or`/`and`
3. **`take+1` sentinel**: fetches one extra row to determine `hasNextPage` without a COUNT query
4. **Backward navigation**: inverts the SQL ORDER BY, then reverses results in-app
5. **Precision**: timestamps are integer epoch-ms, so cursor comparisons are exact — no `date_trunc`/`::timestamptz` handling is needed (as it was on Postgres)

### Usage in Repositories

Repositories call `paginationFactory.paginate({ db, table, pageOptions, where, orderBy })` — the cursor logic is fully encapsulated. No repository changes are needed when switching sort keys or adding new paginated endpoints.

---

## **Health Checks**

- `GET /api/service/health` — DB (`select 1`) + memory-heap health (Redis is a runtime dependency but is not part of the health probe)
- `GET /api/service/up` — `uptimeSeconds`
- `GET /api/service/config` — name, version, env, commit sha/message, timezone, Bun/Node versions

---

## **Testing**

Three tiers, distinguished by file extension:

| Tier            | Files       | Location | What it exercises                                  |
| --------------- | ----------- | -------- | -------------------------------------------------- |
| **Unit**        | `*.test.ts` | `src/`   | Pure logic with mocked dependencies (no I/O)       |
| **Integration** | `*.int.ts`  | `src/`   | Real components against an **in-memory SQLite** DB |
| **E2E**         | `*.e2e.ts`  | `e2e/`   | Full HTTP/WS flows against a **live server**       |

Only `*.test.ts` / `*.spec.ts` are auto-discovered by `bun test`, so integration (`*.int.ts`) and e2e (`*.e2e.ts`) are run by **explicit path**. The `test` / `test:cov` / `test:int` / `test:e2e` scripts route through **`scripts/test.ts`**, a tiny runner that resolves the globs with `Bun.Glob` (reliable across nested dirs — the package.json shell's `**` is not) and passes `bun test` explicit `./`-prefixed paths. `test` + `test:cov` run **unit + integration together**, so CI covers integration.

### Unit + Integration

```bash
bun run test          # Run unit + integration (via scripts/test.ts)
bun run test:unit     # Unit only (*.test.ts)
bun run test:int      # Integration only (*.int.ts)
bun test --watch      # Watch mode (auto-discovered unit tests)
bun run test:cov      # Coverage (unit + integration)
```

**Integration test pattern**: spin up a throwaway DB with `createDrizzleClient(':memory:')` (migrations + audit triggers applied exactly as on boot), then either drive Drizzle directly (e.g. `src/infra/db/triggers.int.ts`) or wire the real provider through a NestJS `TestingModule` with `{ provide: DRIZZLE_DB, useValue: db }` (e.g. `src/users/repos/users.repository.int.ts`).

### E2E Tests (`e2e/**/*.e2e.ts`)

A standalone run against a live server + a throwaway SQLite DB (`SQLITE_DB_PATH` in `e2e/.env`); no other external services needed.

```bash
bun run test:e2e                                            # Run all E2E tests (with DB preload)
bun run test:e2e:single ./e2e/relative/path/to/name.e2e.ts # Run single E2E test
```

### E2E Utilities (`e2e/utils/`)

- `api-client.ts` — HTTP request helper
- `db-client.ts` — direct Drizzle DB access for setup/teardown
- `ws-client.ts` — WebSocket client for gateway tests
- `e2e/setup/preload.ts` — database setup before the test suite

---

## **Scripts Reference**

| Command                          | Description                                                             |
| -------------------------------- | ----------------------------------------------------------------------- |
| `bun dev`                        | Start dev server with hot reload (`bun --watch`)                        |
| `bun run build`                  | Build for production (Bun transpile, `scripts/build.ts`)                |
| `bun start`                      | Start production build (`bun dist/main.js`)                             |
| `bun run test`                   | Run unit + integration tests                                            |
| `bun run test:unit`              | Unit tests only (`*.test.ts`)                                           |
| `bun run test:int`               | Integration tests only (`*.int.ts`, in-memory SQLite)                   |
| `bun run test:cov`               | Unit + integration with coverage                                        |
| `bun run test:e2e`               | Run E2E tests with DB preload                                           |
| `bun run test:e2e:single <path>` | Run single E2E test                                                     |
| `bun run lint`                   | Type-aware lint + fix with Oxlint (`--type-aware --fix`)                |
| `bun run format`                 | Format with oxfmt                                                       |
| `bun run typecheck`              | Typecheck with `tsc` (TS 7 native, single `tsconfig.json`, incl. specs) |
| `bun run mig:gen`                | Generate a Drizzle migration from schema changes                        |
| `bun run mig:run`                | Apply pending migrations                                                |
| `bun run db:push`                | Push schema straight to the DB (dev only)                               |
| `bun run db:studio`              | Open Drizzle Studio                                                     |
| `bun run seed`                   | Run migration-style seeders                                             |
| `bun run create:admin`           | Create admin user interactively                                         |
| `bun run email`                  | Start React Email preview server (port 3035)                            |
| `bun run email:export`           | Export email templates as HTML                                          |
| `bun run gen:env:docs`           | Generate env vars documentation (`env-vars.md`)                         |

---

## **Key Constants (`src/constants.ts`)**

- `GLOBAL_PREFIX = 'api'`, `DOCS_AFFIX = 'docs'`
- `PASSWORD_HASH_ROUNDS = 10`
- `REQUEST_ID_HEADER_KEY = 'X-Request-Id'`
- `LOGGER`: default mask fields (`accessToken`, `jwt`, `password`, `secret`, `key`, `phone`) + default filter events (`/api/service/up`, `/api/service/health`, `/favicon.ico`)
- `FILES`: min 1KB, max 10MB, min name length 6, max 6 files
- `PAGINATION`: default take 10, max 50, max search 256, max cursor 512, order-by precedence [updatedAt, createdAt, id]
- `STRING_LENGTH`: shared column/DTO length caps (EMAIL_MAX 254, SHORT_MAX 128, MEDIUM_MAX 255, PATH_MAX 1024, TEXT_MAX 10000, …)
- `JOB_HANDLER_METADATA` — metadata key for `@JobHandler`
- Time: `MILLISECOND`, `SECOND`, `MINUTE`, `HOUR`, `DAY` (all in ms)

---

## **Docker**

The DB is a local SQLite file; **Redis** is the one companion service (queue, WS adapter, throttler, cache).

- **docker-compose.yml** — dev infrastructure: `app-template-redis` (started by default) + `app-template-db` (Postgres, **behind the `postgres` profile** — only starts with `--profile postgres`, since the app is SQLite-first). Run the app on the host with `bun dev`.
- **docker-compose.full.yml** — `app-backend-full` (SQLite, `DB_TYPE=sqlite`) + `app-redis-full`, plus an optional `app-postgres-full` (`--profile postgres`). SQLite DB persists in `app-data`, Redis in `redis-data`. The app `depends_on` a healthy Redis. Health-checked via `/api/service/health`.
- **Dockerfile** — multi-stage build, `oven/bun:1.3.14-slim` (≥1.3.14 for the built-in `Bun.Image` API), non-root `nestjs` user, `/app/data` for the SQLite file. Schema migrations auto-apply on boot.
