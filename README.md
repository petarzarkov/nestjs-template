# NestJS Template

A production-ready NestJS modular monolith template running on **Bun** — **SQLite-first** persistence (Drizzle ORM), **BullMQ + Redis** for the job queue (with a Bull Board dashboard and sandboxed child-process workers), Zod validation, and modern tooling.

## Tech Stack

| Layer                | Technology                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime              | [Bun](https://bun.sh)                                                                                                                                                                         |
| Framework            | [NestJS 11](https://nestjs.com)                                                                                                                                                               |
| Language             | TypeScript 7 (strict, ESNext) — the [native (Go) compiler](https://github.com/microsoft/typescript-go); `tsc --noEmit` for typechecking                                                       |
| Database             | SQLite via [`bun:sqlite`](https://bun.sh/docs/api/sqlite) + [Drizzle ORM](https://orm.drizzle.team) (synchronous)                                                                             |
| Job Queue            | [BullMQ](https://bullmq.io) + Redis ([Bull Board](https://github.com/felixmosh/bull-board) dashboard, sandboxed workers)                                                                      |
| Cache & Rate Limit   | Redis (`@nestjs/cache-manager` + `@nestjs/throttler` with Redis storage)                                                                                                                      |
| Validation           | [Zod](https://zod.dev) + [nestjs-zod](https://github.com/BenLorantfy/nestjs-zod)                                                                                                              |
| Auth                 | [Better Auth](https://www.better-auth.com) (stateful sessions, email/password, Google, GitHub, LinkedIn) via [`@thallesp/nestjs-better-auth`](https://github.com/ThallesP/nestjs-better-auth) |
| WebSockets           | Socket.io with Redis adapter (multi-node)                                                                                                                                                     |
| Email                | [Resend](https://resend.com) + [React Email](https://react.email)                                                                                                                             |
| AI                   | [Vercel AI SDK](https://sdk.vercel.ai) (Gemini, Groq, OpenRouter)                                                                                                                             |
| File Storage         | AWS S3                                                                                                                                                                                        |
| API Docs             | Swagger + [Scalar](https://scalar.com)                                                                                                                                                        |
| Logging              | [@arkv/nestjs-context-logger](https://www.npmjs.com/package/@arkv/nestjs-context-logger) (structured, async-context)                                                                          |
| Admin CMS            | [@arkv/nestjs-cms](https://www.npmjs.com/package/@arkv/nestjs-cms) (OpenAPI-driven admin UI)                                                                                                  |
| Build                | Bun-native transpile (`scripts/build.ts`)                                                                                                                                                     |
| Linting & Formatting | [Oxlint](https://oxc.rs) (type-aware) + [oxfmt](https://oxc.rs)                                                                                                                               |
| Testing              | Bun test runner                                                                                                                                                                               |

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- **Redis** (for the BullMQ queue, Socket.io adapter, throttler, and cache). The DB itself is a local SQLite file — no Postgres needed.

## Quick Start

```bash
# Install dependencies
bun install

# Start Redis (dev infra)
docker compose up -d          # starts a local redis on :6379

# Configure environment
cp .env.example .env
# Edit .env as needed (see env-vars.md). Defaults (localhost:6379) work out of the box.

# Start development server (SQLite migrations auto-apply on boot)
bun dev
```

Optionally seed an admin user:

```bash
bun run seed            # runs migration-style seeders (default admin)
# or interactively:
bun run create:admin
```

## Features

### Authentication & Authorization

- **Better Auth** (`@thallesp/nestjs-better-auth`) with **stateful sessions stored in Redis** (signed cookie, or `Authorization: Bearer <sessionToken>` via the `bearer` plugin)
- Email/password auth with scrypt hashing (handled internally by Better Auth)
- OAuth2 providers: Google, GitHub, LinkedIn (accounts stored per user in the `account` table)
- Role-based access control (RBAC) with `admin` and `user` roles, plus user ban/unban (`admin` plugin)
- Password reset flow with email tokens
- Invite-based registration (public `POST /api/invites/accept`)

### Database & ORM

- **Drizzle ORM over `bun:sqlite`** — fully **synchronous** data access (no `await` on queries)
- Automatic `casing: 'snake_case'` mapping (camelCase properties → snake_case columns)
- **Boot-time migrator** — migrations auto-apply on startup, so a fresh SQLite file is always schema-current
- Timestamps as integer epoch-ms, JSON columns via `text({ mode: 'json' })`, `$inferSelect`/`$inferInsert` row types
- Explicit, readable index/constraint names in the schema files
- Automatic **audit logging via SQLite triggers** (not application code) — old/new JSON snapshots written to `audit_log`
- `postgres` reserved as a future async data layer (config surface present; the module throws if selected)

### Job Queue System

- **BullMQ queues over Redis**, registered via `@nestjs/bullmq`
- Declarative `@JobHandler()` decorator for job routing; auto-discovery via NestJS `DiscoveryService`
- **Sandboxed workers**: the `background-jobs-queue` runs in a **separate child process** per worker (BullMQ sandboxed processor bootstrapping a trimmed Nest context), isolating heavy work from the HTTP process; the `notifications-events-queue` runs in-process
- **Bull Board** dashboard at `/api/queues`
- Configurable concurrency, retries with exponential backoff, per-job timeout, and rate limiting

### Real-time Communication

- Socket.io WebSocket gateway authenticated via Better Auth sessions (bearer session token)
- **Redis adapter** for cross-process / multi-node broadcast (sandboxed workers emit via a Redis emitter)
- Room-based messaging: chat (all users), private (per user), admin-only
- AI response streaming over WebSocket

### Email Notifications

- Resend API integration
- React Email templates with local preview server
- Event-driven: welcome, invite, and password reset emails

### AI Integration

- Unified interface via Vercel AI SDK
- Providers: Google Gemini, Groq, OpenRouter
- REST endpoint for queries + WebSocket streaming
- Dynamic model discovery from provider APIs

### File Management

- AWS S3 upload, download, delete with presigned URLs
- File metadata persistence (name, size, MIME type, image dimensions)
- Validation: size limits (1KB–10MB), name length, file count

### Admin CMS

- OpenAPI-driven admin UI (`@arkv/nestjs-cms`) served at `/cms` — CRUD resources are generated from the Swagger document
- Schema endpoint at `/cms/schema`; logs in against this API via the documented `/api/auth/sign-in/email` endpoint
- Zero hand-written admin pages: document an endpoint and it shows up

### Observability

- Structured JSON logging with `AsyncLocalStorage`-based context (`@arkv/nestjs-context-logger`)
- `warn`/`error`/`fatal` go to stderr; everything else to stdout
- Request ID propagation (`X-Request-Id` header)
- Sensitive field masking in logs (password, jwt, token, secret, key, phone)
- Health check endpoints (DB, memory)
- HTTP request/response logging with timing

### Validation & Error Handling

- **Zod** schemas via `createZodDto` (nestjs-zod), enforced by a global `ZodValidationPipe`
- `GenericExceptionFilter` for consistent error responses
- `DbExceptionFilter` maps `bun:sqlite` constraint errors (unique → 409, FK/not-null → 400)

### Cursor-based Pagination

- Keyset (cursor) pagination on all list endpoints — no offset/page numbers
- Opaque Base64url-encoded cursors for stable, index-friendly paging
- Bidirectional navigation (`forward` / `backward`)
- `take+1` sentinel strategy (no COUNT queries)
- Automatic sort key detection (`updatedAt` → `createdAt` → `id`)
- Exact integer-millisecond timestamp comparison (no `date_trunc` needed)

### Rate Limiting & Cache

- `@nestjs/throttler` with **Redis** storage (`@nest-lab/throttler-storage-redis`)
- Three-tier throttling: short (10/1s), medium (50/10s), long (300/60s) — skipped for authenticated users
- Environment-aware `@EnvThrottle()` decorator (Redis sliding window)
- Redis-backed REST cache (`@nestjs/cache-manager`) with an opt-in `HttpCacheInterceptor` + `@NoCache()`

### Developer Experience

- Type-aware Oxlint for linting and oxfmt for formatting
- TypeScript 7 (`typescript@7`, the native Go compiler — `tsc --noEmit`) for fast typechecking
- Husky + lint-staged for pre-commit hooks (run the same `lint`/`format` scripts)
- Swagger + Scalar API documentation with optional basic auth
- `bun dev` with hot reload via `bun --watch`

### Integrations

- **Slack**: Bot notifications with rich message formatting
- **AWS S3**: File storage with presigned URL support

## Scripts

```bash
# Development
bun dev                                   # Dev server with hot reload
bun run build                             # Build for production (Bun transpile)
bun start                                 # Start production build

# Testing — unit (*.test.ts) + integration (*.int.ts, in-memory SQLite) live in src/
bun run test                              # Run unit + integration
bun run test:unit                         # Unit only (*.test.ts)
bun run test:int                          # Integration only (*.int.ts)
bun test --watch                          # Watch mode (unit)
bun run test:cov                          # Coverage (unit + integration)
bun run test:e2e                          # Run E2E tests (*.e2e.ts, live server + throwaway SQLite DB)
bun run test:e2e:single ./e2e/path.e2e.ts # Run single E2E test

# Database
bun run mig:gen                           # Generate a Drizzle migration from schema changes
bun run mig:run                           # Apply pending migrations
bun run db:push                           # Push schema straight to the DB (dev only)
bun run db:studio                         # Open Drizzle Studio
bun run seed                              # Run migration-style seeders

# Code Quality
bun run lint                              # Type-aware lint + fix with Oxlint
bun run format                            # Format with oxfmt
bun run typecheck                         # Typecheck with tsc (TypeScript 7 native)

# Utilities
bun run create:admin                      # Create admin user interactively
bun run email                             # Email template preview (port 3035)
bun run email:export                      # Export email templates as HTML
bun run gen:env:docs                      # Generate env vars documentation
```

## Project Structure

```
src/
├── main.ts               # Application bootstrap
├── app.module.ts          # Root module
├── constants.ts           # Global constants
├── config/                # Type-safe environment configuration (Zod)
├── core/                  # Shared utilities (decorators, filters, interceptors, pagination, zod)
├── infra/                 # Infrastructure (db, redis, queue, health)
├── auth/                  # Better Auth config (sessions, OAuth) + session/account/verification schema
├── users/                 # User management + invites submodule
├── audit/                 # Automatic change logging via SQLite triggers
├── file/                  # File upload + S3 storage
├── notifications/         # Email, WebSocket, Slack, queue handlers
└── ai/                    # Multi-provider AI integration

e2e/                       # End-to-end tests (throwaway SQLite DB)
public/                    # Static files (demo chat UI - testing only)
scripts/                   # CLI utilities (build, seed, admin creation, env docs)
```

Each domain module keeps its Drizzle table in a `schema/` folder and its Swagger response shape in an `entity/` folder (`@ApiProperty` classes).

## API Endpoints

| Route                                                   | Description                                |
| ------------------------------------------------------- | ------------------------------------------ |
| `POST /api/auth/sign-in/email`                          | Email/password login (→ `{ token, user }`) |
| `POST /api/auth/sign-up/email`                          | Register with email + password             |
| `POST /api/auth/forget-password`                        | Request password reset                     |
| `POST /api/auth/reset-password`                         | Reset password                             |
| `GET /api/auth/sign-in/social/{google,github,linkedin}` | OAuth login                                |
| `GET /api/users`                                        | List users (cursor paginated)              |
| `GET /api/invites`                                      | Manage invites                             |
| `POST /api/invites/accept`                              | Accept an invite (public)                  |
| `POST /api/ai/query`                                    | AI query                                   |
| `GET /api/ai/models`                                    | List AI models                             |
| `POST /api/files`                                       | Upload file                                |
| `GET /api/files`                                        | List files (cursor paginated)              |
| `GET /api/audit`                                        | Query audit logs (cursor paginated)        |
| `GET /api/service/health`                               | Health check (DB, memory)                  |
| `GET /api/service/up`                                   | Uptime check                               |
| `GET /api/service/config`                               | Service configuration                      |
| `GET /api/queues`                                       | Bull Board queue dashboard                 |
| `GET /cms`                                              | Admin CMS UI (OpenAPI-driven)              |

## Documentation

- **API Docs**: Swagger UI at `/api/docs` + Scalar at `/api/public` (when running)
- **Admin CMS**: OpenAPI-driven admin UI at `/cms`
- **Environment Variables**: See [env-vars.md](./env-vars.md) for the full configuration reference

## Docker

- **Dev** — `docker compose up -d` starts a local Redis (the app runs on the host via `bun dev`; the DB is a local SQLite file). Postgres is available but opt-in: `docker compose --profile postgres up -d`.
- **Full stack** — the app + Redis together:

```bash
cp .env.example .env.full                 # Setup env
docker compose -f docker-compose.full.yml --env-file .env.full up -d    # Start (app + redis)
docker compose -f docker-compose.full.yml --env-file .env.full down     # Stop
```

The SQLite database persists in the `app-data` volume (`/app/data`) and Redis data in `redis-data`. To rebuild the backend:

```bash
docker compose -f docker-compose.full.yml --env-file .env.full build --no-cache app-backend-full
docker compose -f docker-compose.full.yml --env-file .env.full up -d app-backend-full
```

## License

MIT
