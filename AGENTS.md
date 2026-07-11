---
alwaysApply: true
---

You are a **senior TypeScript programmer** with extensive experience in the **NestJS framework** and **Bun runtime**, strongly favoring **clean programming** and **design patterns**.

Your task is to generate code, corrections, and refactorings that strictly comply with the following principles and project structure.

---

## **Project Overview**

This is a **NestJS modular monolith template** running on **Bun** as the runtime and package manager. It is **SQLite-first**: the app boots with **zero external services** (no Postgres, no Redis). Persistence is **Drizzle ORM over `bun:sqlite`** (synchronous), the job queue is **bunqueue** (SQLite-backed, in-process), and validation is **Zod** via **nestjs-zod**.

### Runtime & Tooling

- **Runtime:** Bun (not Node.js)
- **Package Manager:** Bun (`bun install`, `bun add`)
- **Test Runner:** Bun test (`bun test`)
- **TypeScript:** Native Bun execution (no ts-node/tsx), target ESNext, module ESNext, moduleResolution bundler
- **Password Hashing:** `Bun.password` API (not bcrypt) — see `src/core/utils/password.util.ts`
- **Typecheck:** `tsgo` (TypeScript 7 / `@typescript/native-preview`) via `bun run typecheck` — typechecks the whole project via the single `tsconfig.json` (app + e2e + scripts + specs)
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
├── config/                    # Environment configuration module (Zod-validated)
│   ├── app.config.module.ts   # Dynamic config module (.forRoot)
│   ├── services/app.config.service.ts  # Typed config access
│   ├── env.validation.ts      # Config validation with Zod (envSchema.safeParse)
│   ├── env-vars.dto.ts        # Merged Zod env schema (+ cross-field superRefine)
│   ├── config-validation.error.ts       # Thrown on invalid config
│   ├── logger.config.ts       # NestJsContextLoggerModule.forRootAsync factory (shared)
│   ├── dto/                   # Grouped Zod config schemas (service, db, queue, oauth, ai, aws, ws)
│   └── enum/                  # AppEnv (local|dev|stage|prod), DbType (sqlite|postgres)
├── core/                      # Global utilities (NOT a NestJS module)
│   ├── decorators/            # @Public, @Roles/@RequireAllRoles, @CurrentUser, @ApiJwtAuth,
│   │                          # @ValidatedFiles, @UUIDParam, @EnvThrottle
│   ├── filters/               # GenericExceptionFilter, DbExceptionFilter
│   ├── interceptors/          # HttpLoggingInterceptor, AuditContextInterceptor
│   ├── middlewares/           # RequestMiddleware (context+requestId), HtmlBasicAuthMiddleware (docs/queues auth)
│   ├── pagination/            # Cursor-based pagination: PaginationFactory, PageDto, PageMetaDto, PageOptionsDto, cursor.util
│   ├── zod/                   # Shared Zod schemas (emailSchema, passwordSchema)
│   ├── validators/            # File size/name validators
│   ├── helpers/               # HelpersModule (global helper services)
│   ├── utils/                 # password.util (Bun.password wrapper)
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
│   ├── throttler/             # In-memory rate limiting (RateLimitModule + EnvThrottlerGuard) — no Redis
│   └── queue/                 # QueueModule, JobDispatcherService, JobPublisherService, @JobHandler, dashboard
│       ├── decorators/        # @JobHandler({ queue, name })
│       ├── services/          # JobDispatcherService (discovers handlers, runs bunqueue), JobPublisherService
│       ├── queue-dashboard.controller.ts  # Lightweight /api/queues dashboard (replaces Bull Board)
│       └── types/             # QueueJob type definitions
├── auth/                      # AuthModule (.forRoot) — JWT + OAuth
│   ├── auth.controller.ts     # /auth routes: login, register, password reset, OAuth callbacks
│   ├── services/              # AuthService — auth business logic, token creation
│   ├── strategies/            # Passport: JwtStrategy, LocalStrategy, GoogleStrategy, GithubStrategy, LinkedInStrategy
│   ├── guards/                # JwtAuthGuard (global), RolesGuard (global)
│   ├── entity/                # AuthProvider Swagger DTO
│   ├── schema/                # auth_providers Drizzle table
│   ├── repos/                 # AuthProvidersRepository (Drizzle)
│   ├── enum/                  # OAuthProvider: google | github | linkedin | local
│   └── dto/                   # Login, Register (union), Password reset, response DTOs
├── users/                     # UsersModule
│   ├── users.controller.ts    # /users routes
│   ├── services/              # UsersService — user CRUD
│   ├── entity/                # User, PasswordResetToken Swagger DTOs (+ sanitizeUser helper)
│   ├── schema/                # user, password_reset_token Drizzle tables
│   ├── enum/                  # UserRole: admin | user
│   ├── repos/                 # UsersRepository, PasswordResetTokensRepository (Drizzle)
│   ├── dto/                   # User DTOs
│   └── invites/               # Nested InvitesModule submodule
│       ├── invites.controller.ts
│       ├── services/          # InvitesService
│       ├── entity/            # Invite Swagger DTO
│       ├── schema/            # invite Drizzle table
│       ├── enum/              # InviteStatus: pending | accepted | expired
│       ├── repos/             # InvitesRepository (Drizzle)
│       └── dto/               # CreateInviteDto, ListInvitesDto
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
- **Infrastructure modules** live under `src/infra/` (db, throttler, queue, health). Logging is the external `@arkv/nestjs-context-logger`.

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
| `strategies/` | Passport strategies (auth module)                              |
| `validators/` | Module-specific validators                                     |

> **`schema/` vs `entity/`**: `schema/*.schema.ts` holds the Drizzle table (persistence + inferred `Row`/`NewRow` types). `entity/*.entity.ts` holds the `@ApiProperty` DTO class that documents the JSON the API returns. They are intentionally separate — the SQLite row and the API response are not the same type (e.g. `password` is never serialized; `SanitizedUser = OmitType(User, ['password'])`).

### Core Utilities (`src/core/`) — NOT a NestJS module

Imported directly via `@/core/...`:

- `@/core/decorators` — Custom parameter & metadata decorators
- `@/core/filters` — Exception filters (registered globally in `main.ts`)
- `@/core/interceptors` — HttpLoggingInterceptor, AuditContextInterceptor (registered globally)
- `@/core/middlewares` — RequestMiddleware (Express-level), HtmlBasicAuthMiddleware
- `@/core/pagination` — Cursor-based PaginationFactory service, DTOs, cursor utilities
- `@/core/zod` — Shared Zod schemas (`emailSchema`, `passwordSchema`)
- `@/core/utils` — password.util (Bun.password wrapper)
- `@/core/validators` — File validators (size, name length)
- `@/core/docs` — Swagger + Scalar API documentation setup
- `@/core/helpers` — HelpersModule (global utilities): `HelpersService` (retry/backoff, stopwatch, safe stringify) and `FetchService` (fetch-based HTTP client — per-request timeout, retry, context-scoped logging, NestJS error mapping; prefer it over plain `fetch`)

### Custom Decorators (`src/core/decorators/`)

| Decorator                             | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `@Public()`                           | Bypass JWT & Roles guards                  |
| `@Roles(role)` / `@RequireAllRoles()` | Role-based access control                  |
| `@CurrentUser()`                      | Extract authenticated user from request    |
| `@ApiJwtAuth()`                       | Swagger JWT security annotation            |
| `@ValidatedFiles(opts)`               | File upload validation (size, name, count) |
| `@UUIDParam(name)`                    | Parse + validate UUID route parameter      |
| `@EnvThrottle(opts)`                  | Environment-aware rate limiting            |

> The old class-validator decorators (`@Password`, `@Email`, `@IsNullable`, `@IsUniqueEnum`), plus `@Auditable` and `@NoCache`, were removed. Field validation now lives in Zod schemas (`@/core/zod`); audit is DB-trigger driven; there is no HTTP cache layer.

---

## **Global Bootstrap (`src/main.ts`)**

The application bootstrap registers these globally:

1. `ContextLogger` (from `@arkv/nestjs-context-logger`) — structured logger replacing the NestJS default
2. `RequestMiddleware` — Express-level middleware for request context (requestId, timestamps)
3. `ZodValidationPipe` (nestjs-zod) — registered as `APP_PIPE` in `app.module.ts`; validates all `createZodDto` bodies/queries
4. `HttpLoggingInterceptor` — logs all HTTP requests/responses with timing (`APP_INTERCEPTOR`)
5. `AuditContextInterceptor` — writes the current actor id into `_audit_ctx` for the DB audit triggers (`APP_INTERCEPTOR`)
6. `GenericExceptionFilter` + `DbExceptionFilter` — consistent error responses (the DB filter maps `bun:sqlite` constraint errors → 409/400)
7. `SocketConfigAdapter` — Socket.io adapter (single-node, in-memory — no Redis)
8. CORS enabled, trust proxy, global prefix `api`
9. API docs served at `/api/docs` (Swagger) and `/api/public` (Scalar); `setupDocs` returns the OpenAPI document
10. `/api/queues` (queue dashboard) is protected by `HtmlBasicAuthMiddleware` (basic auth in deployed envs)
11. `NestJsCmsModule.setup(app, document, …)` — mounts the admin CMS UI at `/cms` (after docs, before `listen`)

---

## **Config Module**

- **Environment validation** in `env.validation.ts` using **Zod** — `envSchema.safeParse(config)`; failures throw `ConfigValidationError` with a readable path/message list. `class-validator`/`class-transformer` are **not** used.
- **Typed config** via `AppConfigService<ValidatedConfig>` (extends `ConfigService<…, true>`) — access with `.get('db')`, `.getOrThrow('jwt')`, etc.
- **Config DTOs** in `config/dto/` (each exports a Zod schema + a `getXConfig()` mapper): `service-vars`, `db-vars`, `queue-vars`, `oauth-vars`, `ai-vars`, `aws-vars`, `ws-vars`
- **Config groups** (top-level keys of `ValidatedConfig`): `isProd`, `app`, `log`, `http`, `service`, `slack`, `jwt`, `ws`, `cors`, `email`, `db`, `queue`, `oauth`, `ai`, `aws`
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

### Tables / Entities (6)

| Table (entity DTO)                | Module        | Key Fields                                                                                   |
| --------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `user` (`User`)                   | users         | id, email, password, displayName, picture, roles (`UserRole[]` JSON), suspended              |
| `password_reset_token`            | users         | id, userId, token, used, expiresAt                                                           |
| `auth_providers` (`AuthProvider`) | auth          | id, userId, provider, authProviderId, passwordHash                                           |
| `invite` (`Invite`)               | users/invites | id, email, inviteCode, role, status, expiresAt                                               |
| `audit_log` (`AuditLog`)          | audit         | id, actorId, action, entityName, entityId, oldValue (JSON), newValue (JSON) — no `updatedAt` |
| `files` (`FileEntity`)            | file          | id, name, extension, mimetype, size, width, height, path, userId                             |

Enums: `UserRole` (admin|user), `OAuthProvider` (google|github|linkedin|local), `InviteStatus` (pending|accepted|expired), `AuditAction` (INSERT|UPDATE|DELETE).

### Database & Seeder Commands

```bash
bun run mig:gen               # Generate a Drizzle migration from schema changes (drizzle-kit generate)
bun run mig:run               # Apply pending migrations (drizzle-kit migrate)
bun run db:push               # Push schema straight to the DB (drizzle-kit push — dev only)
bun run db:studio             # Open Drizzle Studio
bun run seed                  # Run migration-style seeders (scripts/seed.ts; tracked in a __seeders table)
```

> Migrations also run automatically on app boot via the client's `migrate()` call, so a fresh SQLite file is always schema-current. The default seeder (`0000_admin.seeder.ts`) creates an admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (defaults `admin@local.dev` / `Admin123$`).

---

## **Authentication & Authorization**

### Passport Strategies

- **LocalStrategy** — email/password login
- **JwtStrategy** — JWT token validation (global guard)
- **GoogleStrategy** — Google OAuth2
- **GithubStrategy** — GitHub OAuth2
- **LinkedInStrategy** — LinkedIn OAuth2

### Guards (globally registered)

- **JwtAuthGuard** — validates JWT on all routes (skip with `@Public()`)
- **RolesGuard** — RBAC, use `@Roles(UserRole.ADMIN)` to restrict; `@RequireAllRoles()` to require all listed roles

### Auth Endpoints (`/api/auth/`)

- `POST /login` — local email/password
- `POST /register` — new user or invite-based registration (Swagger shows a `oneOf` of the email/invite payloads; validated on-route via `new ZodValidationPipe(registerSchema)`)
- `POST /forgotten-password` — request password reset
- `POST /password-reset` — reset with token
- `GET /google`, `/google/callback` — Google OAuth
- `GET /github`, `/github/callback` — GitHub OAuth
- `GET /linkedin`, `/linkedin/callback` — LinkedIn OAuth

---

## **Job Queue System (bunqueue — SQLite-backed)**

No Redis, no BullMQ. Each queue is an **embedded `bunqueue` instance** (`new Bunqueue(name, { embedded: true, … })` from `bunqueue/client`) persisted to its own SQLite file under `QUEUE_DATA_PATH`, running in-process.

### Queues

- `notifications-events-queue` — email + WS notifications (the default publish target)
- `background-jobs-queue` — long-running background tasks

### Job Handler Pattern

`JobDispatcherService` discovers `@JobHandler` methods via NestJS `DiscoveryService` + `MetadataScanner` + `Reflector` (metadata key `JOB_HANDLER_METADATA`) on module init and wires each `(queue, name)` pair as a bunqueue route (with per-job ContextLogger context + timeout):

```typescript
@JobHandler({ queue: EVENTS.QUEUES.BACKGROUND_JOBS, name: EVENTS.ROUTING_KEYS.USER_REGISTERED })
async handleUserRegistered(job: JobHandlerPayload<typeof EVENTS.ROUTING_KEYS.USER_REGISTERED>) { ... }
```

### Published Events (`src/notifications/events/events.ts`)

| Routing Key           | Payload              | Action                          |
| --------------------- | -------------------- | ------------------------------- |
| `user.registered`     | RegisteredPayload    | Welcome email + WS notification |
| `user.invited`        | InvitePayload        | Invite email + WS notification  |
| `user.password_reset` | PasswordResetPayload | Password reset email            |

### Publishing Jobs

```typescript
await jobPublisher.publishJob(EVENTS.ROUTING_KEYS.USER_REGISTERED, payload, {
  emitToAdmins: true,
});
```

### Queue Dashboard

- Lightweight self-hosted dashboard at `/api/queues` (`QueueDashboardController`) — per-queue job counts plus `/api/queues/stats` (JSON). It replaces Bull Board and is protected by `HtmlBasicAuthMiddleware` in deployed envs.

### Tuning (`QUEUE_*` env vars → `queue.*` config)

`QUEUE_DATA_PATH` (default `./data/queue`), `QUEUE_CONCURRENCY` (5), `QUEUE_MAX_RETRIES` (3), `QUEUE_RETRY_DELAY_MS` (1000, exponential backoff), `QUEUE_JOB_TIMEOUT_MS` (30000), `QUEUE_RATE_LIMIT_MAX` (100), `QUEUE_RATE_LIMIT_DURATION` (1000).

---

## **WebSocket (Socket.io — single-node)**

- **EventsGateway** — JWT-authenticated Socket.io gateway
- **SocketConfigAdapter** — configures Socket.io; **in-memory, single-node** (cross-instance broadcast via a Redis adapter is out of scope for this template). Shares the HTTP server unless `WS_PORT` differs from the app port.
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
- **Filtered endpoints** (never logged; matched by exact `event` path via `filterEvents`): `/api/service/up`, `/api/service/health`, `/api/queues`, `/api/queues/stats`, `/favicon.ico`

---

## **Rate Limiting (in-memory)**

- **RateLimitModule** (`@nestjs/throttler`) with the default **in-memory** storage — no Redis, single-node
- **`EnvThrottlerGuard`** — driven by the `@EnvThrottle()` decorator, applies environment-aware limits via an in-process sliding window
- **Throttle tiers**: short (10/1s), medium (50/10s), long (300/60s) — skipped for authenticated users
- There is **no HTTP cache layer** (the old Redis cache-manager was removed)

---

## **Notifications**

- **Email**: Resend API + React Email templates (welcome, invite, password reset)
- **WebSocket**: Socket.io gateway with JWT auth
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
- **Auth**: `setupDocs` adds `x-cms-login-endpoint` (`/api/auth/login`) and `x-cms-token-path` (`accessToken`) extensions so the CMS logs in against this API.
- **UI**: `GET /cms` (admin UI), `GET /cms/schema` (blueprint). The bundled UI ships inside the npm package.

---

## **Audit Logging (SQLite triggers)**

- **DB-trigger driven** (not application code): `src/infra/db/triggers.ts` installs `AFTER INSERT/UPDATE/DELETE` triggers on audited tables (`user`, `invite`) that write old/new JSON snapshots into `audit_log`. Applied idempotently on every boot by `applyAuditTriggers()`. Replaces the old TypeORM `EntitySubscriber`.
- **Actor attribution**: `AuditContextInterceptor` writes the current user id into a single-row `_audit_ctx` table per request; triggers read `actor_id` from it. Because SQLite uses one shared connection, actor attribution is best-effort under concurrency — the change data itself is always exact. (`password` is excluded from snapshots.)
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

- `GET /api/service/health` — DB (`select 1`) + memory-heap health (no Redis check — SQLite is the only external dependency)
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

| Command                          | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `bun dev`                        | Start dev server with hot reload (`bun --watch`)          |
| `bun run build`                  | Build for production (Bun transpile, `scripts/build.ts`)  |
| `bun start`                      | Start production build (`bun dist/main.js`)               |
| `bun run test`                   | Run unit + integration tests                              |
| `bun run test:unit`              | Unit tests only (`*.test.ts`)                             |
| `bun run test:int`               | Integration tests only (`*.int.ts`, in-memory SQLite)     |
| `bun run test:cov`               | Unit + integration with coverage                          |
| `bun run test:e2e`               | Run E2E tests with DB preload                             |
| `bun run test:e2e:single <path>` | Run single E2E test                                       |
| `bun run lint`                   | Type-aware lint + fix with Oxlint (`--type-aware --fix`)  |
| `bun run format`                 | Format with oxfmt                                         |
| `bun run typecheck`              | Typecheck with tsgo (single `tsconfig.json`, incl. specs) |
| `bun run mig:gen`                | Generate a Drizzle migration from schema changes          |
| `bun run mig:run`                | Apply pending migrations                                  |
| `bun run db:push`                | Push schema straight to the DB (dev only)                 |
| `bun run db:studio`              | Open Drizzle Studio                                       |
| `bun run seed`                   | Run migration-style seeders                               |
| `bun run create:admin`           | Create admin user interactively                           |
| `bun run email`                  | Start React Email preview server (port 3035)              |
| `bun run email:export`           | Export email templates as HTML                            |
| `bun run gen:env:docs`           | Generate env vars documentation (`env-vars.md`)           |

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

SQLite-first — the container runs standalone with no companion database/cache services.

- **docker-compose.full.yml** — a single `app-backend-full` service; SQLite DB + bunqueue storage persist in the `app-data` volume (`/app/data`). Health-checked via `/api/service/health`. (There is no `docker-compose.yml` — the app needs no external infrastructure to run.)
- **Dockerfile** — multi-stage build, `oven/bun:1.3.14-slim` (≥1.3.14 for the built-in `Bun.Image` API), non-root `nestjs` user, `/app/data` for SQLite + queue storage. Schema migrations auto-apply on boot.
