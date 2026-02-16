---
alwaysApply: true
---

You are a **senior TypeScript programmer** with extensive experience in the **NestJS framework** and **Bun runtime**, strongly favoring **clean programming** and **design patterns**.

Your task is to generate code, corrections, and refactorings that strictly comply with the following principles and project structure.

---

## **Project Overview**

This is a **NestJS monolith template** running on **Bun** as the runtime and package manager.

### Runtime & Tooling
- **Runtime:** Bun (not Node.js)
- **Package Manager:** Bun (`bun install`, `bun add`)
- **Test Runner:** Bun test (`bun test`)
- **TypeScript:** Native Bun execution (no ts-node/tsx), TypeScript 5.9, target ESNext, module NodeNext
- **Password Hashing:** `Bun.password` API (not bcrypt) — see `src/core/utils/password.util.ts`
- **Linting & Formatting:** Biome 2.x (`bun run lint`, `bun run format`) — single quotes, trailing commas, 80-char lines, GritQL plugins in `plugins/` for TypeORM constraint naming enforcement
- **Build:** `nest build` + `tsc-alias` for path alias resolution in dist

### Path Aliases
Configured in `tsconfig.json`:
- `@/*` → `src/*`

---

## **Project Structure**

```
src/
├── main.ts                    # Bootstrap: express app, global pipes/filters/interceptors, CORS, WS adapter
├── app.module.ts              # Root module — imports all feature & infra modules
├── constants.ts               # Global constants (LOGGER, FILES, PAGINATION, time units)
├── config/                    # Environment configuration module
│   ├── app.config.module.ts   # Dynamic config module (.forRoot)
│   ├── services/app.config.service.ts  # Typed config access
│   ├── env.validation.ts      # Config validation with class-transformer + class-validator
│   ├── env-vars.dto.ts        # Raw env var DTO
│   ├── dto/                   # Grouped config DTOs (service, db, redis, oauth, ai)
│   └── enum/                  # AppEnv: local | dev | stage | prod
├── core/                      # Global utilities (NOT a NestJS module)
│   ├── decorators/            # @Public, @Roles, @CurrentUser, @ApiJwtAuth, @Auditable,
│   │                          # @Password, @Email, @IsNullable, @IsUniqueEnum,
│   │                          # @ValidatedFiles, @UUIDParam, @NoCache, @EnvThrottle
│   ├── filters/               # GenericExceptionFilter, TypeOrmExceptionFilter
│   ├── interceptors/          # HttpLoggingInterceptor
│   ├── middlewares/           # RequestMiddleware (context+requestId), HtmlBasicAuthMiddleware (docs auth)
│   ├── pagination/            # Cursor-based pagination: PaginationFactory, PageDto, PageMetaDto, PageOptionsDto, cursor.util, PaginationDirection
│   ├── pipes/                 # UnionValidationPipe
│   ├── validators/            # Custom class-validator decorators
│   ├── helpers/               # HelpersModule (global helper services)
│   ├── utils/                 # password.util (Bun.password wrapper)
│   └── docs/                  # Swagger + Scalar API docs setup
├── infra/                     # Infrastructure layer
│   ├── db/                    # DatabaseModule (.forRoot), data-source-options, SnakeNamingStrategy
│   │   ├── migrations/        # TypeORM migrations
│   │   ├── strategies/        # SnakeNamingStrategy
│   │   └── lock/              # PostgreSQL advisory lock module
│   ├── logger/                # LoggerModule, ContextLogger, ContextService (AsyncLocalStorage)
│   ├── health/                # HealthModule: /service/health, /service/up, /service/config
│   ├── redis/                 # RedisModule, RedisCacheThrottlerModule, RedisService
│   └── queue/                 # QueueModule, JobModule, JobProcessor, @JobHandler decorator
│       ├── decorators/        # @JobHandler({ queue, name })
│       ├── services/          # JobPublisherService, JobDispatcherService
│       └── types/             # QueueJob type definitions
├── auth/                      # AuthModule (.forRoot) — JWT + OAuth
│   ├── auth.controller.ts     # /auth routes: login, register, password reset, OAuth callbacks
│   ├── auth.service.ts        # Auth business logic, token creation
│   ├── strategies/            # Passport: JwtStrategy, LocalStrategy, GoogleStrategy, GithubStrategy, LinkedInStrategy
│   ├── guards/                # JwtAuthGuard (global), RolesGuard (global)
│   ├── entity/                # AuthProvider entity (OAuth provider linking)
│   ├── repos/                 # AuthProvidersRepository
│   └── dto/                   # Login, Register, Password reset, OAuth DTOs
├── users/                     # UsersModule
│   ├── users.controller.ts    # /users routes
│   ├── users.service.ts       # User CRUD
│   ├── entity/                # User, PasswordResetToken entities
│   ├── enum/                  # UserRole: admin | user
│   ├── repos/                 # UsersRepository, PasswordResetTokensRepository
│   ├── dto/                   # User DTOs
│   └── invites/               # Nested InvitesModule submodule
│       ├── invites.controller.ts
│       ├── invites.service.ts
│       ├── entity/            # Invite entity
│       ├── enum/              # InviteStatus: pending | accepted | expired
│       ├── repos/             # InvitesRepository
│       └── dto/               # CreateInviteDto, ListInvitesDto
├── audit/                     # AuditModule — automatic entity change logging
│   ├── audit.controller.ts    # /audit routes
│   ├── audit.service.ts       # Audit log queries
│   ├── subscribers/           # TypeORM EntitySubscriber (auto INSERT/UPDATE/DELETE logging)
│   ├── entity/                # AuditLog entity (JSONB old/new values)
│   ├── enum/                  # AuditAction: INSERT | UPDATE | DELETE
│   ├── repos/                 # AuditLogRepository
│   └── dto/                   # AuditLogQueryDto
├── file/                      # FileModule — file upload + S3
│   ├── file.controller.ts     # /files routes: upload, list, download, delete
│   ├── file.service.ts        # File operations
│   ├── s3.service.ts          # AWS S3 integration (presigned URLs, bucket ops)
│   ├── entity/                # FileEntity (name, size, dimensions, S3 path)
│   ├── repos/                 # FileRepository
│   ├── guards/                # MultipartFormDataGuard
│   ├── validators/            # File size/name validators
│   └── dto/                   # FileUploadDto, FileResponseDto
├── notifications/             # NotificationModule — email + WS + Slack + queue handlers
│   ├── notification.module.ts
│   ├── notification-queue.module.ts  # Queue consumer module (JobModule)
│   ├── handlers/              # NotificationHandler (@JobHandler methods)
│   ├── email/                 # EmailModule, EmailService (Resend), React Email templates
│   ├── events/                # EventsModule, EventsGateway (Socket.io), SocketConfigAdapter
│   │   ├── events.ts          # EVENTS constant (queues, routing keys, EventMap types)
│   │   └── events.dto.ts      # WebSocket message types
│   ├── slack/                 # SlackModule, SlackService
│   └── dto/                   # RegisteredPayload, InvitePayload, PasswordResetPayload
└── ai/                        # AIModule (.forRoot) — multi-provider AI
    ├── ai.controller.ts       # /ai routes: query, models
    ├── ai.service.ts          # AI querying + streaming
    ├── services/              # AIProviderService
    ├── enum/                  # AIProvider: google | groq | openrouter
    └── dto/                   # AI request/response DTOs

e2e/                           # E2E tests
├── setup/                     # preload.ts (DB setup), context.ts
├── utils/                     # api-client.ts, db-client.ts, ws-client.ts
├── constants.ts
├── health/                    # health.e2e.spec.ts
├── auth/                      # auth.e2e.spec.ts
├── users/                     # users.e2e.spec.ts (cursor pagination)
└── audit/                     # audit.e2e.spec.ts (cursor pagination)
```

---

## **NestJS Architecture Guidelines**

### Module Pattern
- **One module per domain/feature** (e.g., `users`, `auth`, `notifications`)
- **One controller per main route**, additional controllers for sub-routes
- **Nested submodules** for related features (e.g., `users/invites/`)
- **Dynamic modules** use `.forRoot()` pattern (Auth, Database, AI, Config)
- **Infrastructure modules** live under `src/infra/` (db, redis, queue, logger, health)

### Folder Conventions per Module
| Folder | Purpose |
|--------|---------|
| `dto/` | Request/response DTOs validated with `class-validator` |
| `entity/` | TypeORM entities |
| `enum/` | TypeScript enums |
| `services/` | Business logic services |
| `handlers/` | Job event handlers (decorated with `@JobHandler`) |
| `repos/` | Custom TypeORM repositories (when needed) |
| `guards/` | Module-specific guards |
| `strategies/` | Passport strategies (auth module) |
| `subscribers/` | TypeORM entity subscribers (audit module) |
| `validators/` | Module-specific validators |

### Core Utilities (`src/core/`) — NOT a NestJS module
Imported directly via `@/core/...`:
- `@/core/decorators` — Custom parameter & metadata decorators
- `@/core/filters` — Exception filters (registered globally in `main.ts`)
- `@/core/interceptors` — HttpLoggingInterceptor (registered globally)
- `@/core/middlewares` — RequestMiddleware (Express-level), HtmlBasicAuthMiddleware
- `@/core/pagination` — Cursor-based PaginationFactory service, DTOs, cursor utilities, module
- `@/core/pipes` — UnionValidationPipe
- `@/core/utils` — password.util (Bun.password wrapper)
- `@/core/validators` — Custom class-validator decorators
- `@/core/docs` — Swagger + Scalar API documentation setup
- `@/core/helpers` — HelpersModule (global utilities)

### Custom Decorators (`src/core/decorators/`)
| Decorator | Purpose |
|-----------|---------|
| `@Public()` | Bypass JWT & Roles guards |
| `@Roles(role)` / `@RequireAllRoles(roles)` | Role-based access control |
| `@CurrentUser()` | Extract authenticated user from request |
| `@ApiJwtAuth()` | Swagger JWT security annotation |
| `@Auditable(options?)` | Mark entity for automatic audit logging |
| `@Password()` | Password strength validation |
| `@Email()` | Email format validation |
| `@IsNullable()` | Allow null values in validation |
| `@IsUniqueEnum()` | Ensure unique enum values in array |
| `@ValidatedFiles(opts)` | File upload validation (size, name, count) |
| `@UUIDParam(name)` | Parse + validate UUID route parameter |
| `@NoCache()` | Disable caching for endpoint |
| `@EnvThrottle(opts)` | Environment-aware rate limiting |

---

## **Global Bootstrap (`src/main.ts`)**

The application bootstrap registers these globally:
1. `ContextLogger` — custom logger replacing NestJS default
2. `RequestMiddleware` — Express-level middleware for request context (requestId, timestamps)
3. `ValidationPipe` — global with `transform: true`, `forbidNonWhitelisted: true`
4. `HttpLoggingInterceptor` — logs all HTTP requests/responses with timing
5. `GenericExceptionFilter` + `TypeOrmExceptionFilter` — consistent error responses
6. `SocketConfigAdapter` — Socket.io with Redis adapter
7. CORS enabled, trust proxy, global prefix `api`
8. API docs served at `/{GLOBAL_PREFIX}/docs` (Swagger) and Scalar

---

## **Config Module**

- **Environment validation** in `env.validation.ts` using `class-transformer` + `class-validator`
- **Typed config** via `AppConfigService<ValidatedConfig>` — access with `.get('db')`, `.getOrThrow('jwt')`, etc.
- **Config DTOs** in `config/dto/`: `ServiceVarsDto`, `DbVarsDto`, `RedisVarsDto`, `OAuthVarsDto`, `AIVarsDto`
- **Config groups**: `app`, `db`, `jwt`, `redis`, `oauth`, `ai`, `aws`, `cors`, `http`, `ws`
- **Environments**: `local`, `dev`, `stage`, `prod` (`AppEnv` enum)

---

## **Database**

### TypeORM Configuration
- **PostgreSQL** via `pg` driver
- **Entities** in `<module>/entity/` folders — auto-discovered
- **SnakeNamingStrategy** — camelCase properties → snake_case columns
- **Migrations** in `src/infra/db/migrations/`
- **Data source config** in `src/infra/db/data-source-options.ts`
- **Advisory locks** via `src/infra/db/lock/pg-lock.module.ts`

### DB Constraint Naming Convention (enforced via Biome GritQL plugins)

All database indexes, foreign keys, and enum types **must** have explicit names — never rely on TypeORM auto-generated names. This makes debugging migration errors and DB issues far easier.

| Constraint Type | Pattern | Example |
|-----------------|---------|---------|
| **Foreign Key** | `FK_{source_table}_to_{target_table}` | `FK_auth_provider_to_user` |
| **Index** | `{descriptive_columns}_index` | `audit_actor_id_index` |
| **Unique Index** | `{descriptive_columns}_index` (with `{ unique: true }`) | `provider_auth_provider_id_index` |
| **Enum Type** | `{snake_case_name}_enum` | `user_role_enum`, `invite_status_enum` |

**Rules:**
- `@Index()` — always pass the index name as the first string argument
- `@JoinColumn()` — always include `foreignKeyConstraintName` property
- `@Column({ type: 'enum' })` — always include `enumName` property
- When two entities share the same TS enum, use the **same `enumName`** in both (e.g., `UserRole` → `'user_role_enum'` everywhere)

These rules are enforced by GritQL plugins in `plugins/` and run as part of `bun run lint`.

### Entities (6)
| Entity | Module | Key Fields |
|--------|--------|------------|
| `User` | users | id, email, name, role, isActive |
| `PasswordResetToken` | users | token, userId, expiresAt |
| `AuthProvider` | auth | provider, providerId, userId |
| `Invite` | users/invites | email, status, invitedBy, token |
| `AuditLog` | audit | entityName, action, oldValues (JSONB), newValues (JSONB), actorId |
| `FileEntity` | file | name, size, mimeType, width, height, s3Key |

### Migration Commands
```bash
bun run mig:gen MyMigration   # Generate migration from entity changes
bun run mig:run               # Run pending migrations
bun run mig:revert            # Revert last migration
bun run db:drop               # Drop entire schema
```

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
- **RolesGuard** — RBAC, use `@Roles(UserRole.ADMIN)` to restrict

### Auth Endpoints (`/api/auth/`)
- `POST /login` — local email/password
- `POST /register` — new user or invite-based registration
- `POST /forgotten-password` — request password reset
- `POST /password-reset` — reset with token
- `GET /google`, `/google/callback` — Google OAuth
- `GET /github`, `/github/callback` — GitHub OAuth
- `GET /linkedin`, `/linkedin/callback` — LinkedIn OAuth

---

## **Job Queue System (BullMQ + Redis)**

### Queues
- `notifications-events-queue` — email + WS notifications
- `background-jobs-queue` — long-running background tasks

### Job Handler Pattern
```typescript
@JobHandler({ queue: EVENTS.QUEUES.BACKGROUND_JOBS, name: EVENTS.ROUTING_KEYS.USER_REGISTERED })
async handleUserRegistered(job: JobHandlerPayload<typeof EVENTS.ROUTING_KEYS.USER_REGISTERED>) { ... }
```

### Published Events (`src/notifications/events/events.ts`)
| Routing Key | Payload | Action |
|-------------|---------|--------|
| `user.registered` | RegisteredPayload | Welcome email + WS notification |
| `user.invited` | InvitePayload | Invite email + WS notification |
| `user.password_reset` | PasswordResetPayload | Password reset email |

### Publishing Jobs
```typescript
await jobPublisher.publishJob(EVENTS.ROUTING_KEYS.USER_REGISTERED, payload, { emitToAdmins: true });
```

### Queue Dashboard
- Bull Board UI available at `/api/queues`

---

## **WebSocket (Socket.io + Redis Adapter)**

- **EventsGateway** — JWT-authenticated Socket.io gateway
- **Redis adapter** — multi-instance broadcast support
- **Rooms**: `chat` (all users), `user_{id}` (private), `admins` (admin-only)
- **Events**: `chatMessage` (broadcast), `aiRequest` (AI streaming)
- **Config**: WS path and transports configurable via env vars

---

## **Logging (`src/infra/logger/`)**

- **ContextLogger** — structured JSON logging with `AsyncLocalStorage`-based context
- **ContextService** — preserves requestId, userId, method, event across async boundaries
- **Features**: error serialization, sensitive field masking (password, jwt, token, secret, key, phone), circular reference handling, array truncation
- **Log levels**: VERBOSE → DEBUG → LOG → WARN → ERROR → FATAL
- **Filtered endpoints**: `/api/service/up`, `/api/service/health`, `/favicon.ico`

---

## **Redis**

- **RedisModule** — IoRedis client wrapper
- **RedisCacheThrottlerModule** — cache-manager + @nestjs/throttler with Redis storage
- **Cache TTL**: configurable via `REDIS_CACHE_TTL` env var
- **Throttle tiers**: short (10/1s), medium (50/10s), long (300/60s) — skipped for authenticated users

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
- **Image dimensions**: extracted via `image-size` and stored

---

## **AI Integration**

- **Providers**: Google Gemini, Groq, OpenRouter (`AIProvider` enum)
- **Vercel AI SDK** (`ai` package) for unified provider interface
- **REST**: `POST /api/ai/query`, `GET /api/ai/models`
- **WebSocket streaming**: real-time AI responses via Socket.io `aiRequest` event
- **Dynamic model discovery** from provider APIs with static fallbacks

---

## **Audit Logging**

- **`@Auditable()` decorator** on entities — auto-tracks changes via TypeORM subscriber
- **AuditLog entity** — stores entityName, action (INSERT/UPDATE/DELETE), oldValues, newValues (JSONB), actorId
- **REST**: `GET /api/audit` — query audit logs with pagination

---

## **Pagination (Cursor / Keyset)**

All paginated endpoints use **cursor-based (keyset) pagination** — no offset/page numbers. This is index-friendly and produces consistent results regardless of concurrent writes.

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `take` | number | 10 | Items per page (1–50) |
| `cursor` | string | — | Opaque cursor from a previous response (omit for first page) |
| `direction` | `forward` \| `backward` | `forward` | Pagination direction |
| `order` | `ASC` \| `DESC` | `DESC` | Sort order |
| `search` | string | — | Optional search filter (endpoint-specific) |

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
Base64url-encoded JSON: `{ "s": "<sort_column_ISO_date>", "i": "<entity_UUID>" }`. The `s` field is the boundary row's sort column value and `i` is the UUID tiebreaker. Invalid cursors return `400 Bad Request`.

### How It Works (`PaginationFactory`)
1. **Sort key resolution**: auto-detects `updatedAt` → `createdAt` → `id` from entity metadata (configurable via `orderBy` parameter)
2. **Cursor WHERE clause**: compound condition `(sort_col < :val) OR (sort_col = :val AND id < :id)` for DESC (inverted for ASC/backward)
3. **`take+1` sentinel**: fetches one extra row to determine `hasNextPage` without a COUNT query
4. **Backward navigation**: inverts SQL ORDER BY, then reverses results in-app
5. **Precision handling**: uses `date_trunc('milliseconds', ...)` in SQL to match JavaScript Date precision (PostgreSQL timestamps have microsecond precision)

### Usage in Repositories
All repositories call `paginationFactory.paginate(queryBuilder, pageOptionsDto)` — the cursor logic is fully encapsulated in the factory. No repository changes needed when switching sort keys or adding new paginated endpoints.

---

## **Health Checks**

- `GET /api/service/health` — DB, memory, Redis health
- `GET /api/service/up` — uptime in seconds
- `GET /api/service/config` — version, env, commit info, feature status

---

## **Testing**

### Unit Tests (`src/**/*.spec.ts`)
```bash
bun test              # Run all unit tests
bun test --watch      # Watch mode
bun test --coverage   # Coverage report
```

### E2E Tests (`e2e/**/*.e2e.spec.ts`)
```bash
bun run test:e2e                                          # Run all E2E tests
bun run test:e2e:single ./e2e/relative/path/to/test.e2e.ts  # Run single E2E test
```

### E2E Utilities (`e2e/utils/`)
- `api-client.ts` — HTTP request helper
- `db-client.ts` — direct DB access for setup/teardown
- `ws-client.ts` — WebSocket client for gateway tests
- `e2e/setup/preload.ts` — database setup before test suite

---

## **Scripts Reference**

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server with hot reload (`bun --watch`) |
| `bun run build` | Build for production (nest build + tsc-alias) |
| `bun start` | Start production build (`bun dist/main.js`) |
| `bun test` | Run unit tests |
| `bun run test:e2e` | Run E2E tests with DB preload |
| `bun run test:e2e:single <path>` | Run single E2E test |
| `bun run lint` | Lint and fix with Biome |
| `bun run format` | Format with Biome |
| `bun run mig:gen <Name>` | Generate TypeORM migration |
| `bun run mig:run` | Run pending migrations |
| `bun run mig:revert` | Revert last migration |
| `bun run db:drop` | Drop database schema |
| `bun run create:admin` | Create admin user interactively |
| `bun run email` | Start React Email preview server (port 3035) |
| `bun run email:export` | Export email templates as HTML |
| `bun run gen:env:docs` | Generate env vars documentation |

---

## **Key Constants (`src/constants.ts`)**

- `GLOBAL_PREFIX = 'api'`
- `PASSWORD_HASH_ROUNDS = 10`
- `REQUEST_ID_HEADER_KEY = 'X-Request-Id'`
- `FILES`: min 1KB, max 10MB, min name length 6, max 6 files
- `PAGINATION`: default take 10, max 50, max cursor 512, order by precedence [updatedAt, createdAt, id]
- Time: `MILLISECOND`, `SECOND`, `MINUTE`, `HOUR`, `DAY` (all in ms)

---

## **Docker**

- **docker-compose.yml** — PostgreSQL 17.5 (port 5438) + Redis 8.4 (port 6383)
- **docker-compose.full.yml** — above + app backend container with health checks
- **Dockerfile** — multi-stage build, `oven/bun:1.3.9-slim`, non-root user
