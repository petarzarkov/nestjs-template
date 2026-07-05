# NestJS Template

A production-ready, **SQLite-first** NestJS modular monolith template running on **Bun** — Drizzle ORM, bunqueue (no Redis), Zod validation, and modern tooling. It boots with **zero external services**.

## Tech Stack

| Layer                | Technology                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Runtime              | [Bun](https://bun.sh)                                                                                                   |
| Framework            | [NestJS 11](https://nestjs.com)                                                                                         |
| Language             | TypeScript (strict, ESNext) — [tsgo / TS 7 Native Preview](https://github.com/microsoft/typescript-go) for typechecking |
| Database             | SQLite via [`bun:sqlite`](https://bun.sh/docs/api/sqlite) + [Drizzle ORM](https://orm.drizzle.team) (synchronous)       |
| Job Queue            | [bunqueue](https://www.npmjs.com/package/bunqueue) — SQLite-backed, in-process (no Redis)                               |
| Validation           | [Zod](https://zod.dev) + [nestjs-zod](https://github.com/BenLorantfy/nestjs-zod)                                        |
| Auth                 | Passport.js (JWT, Google, GitHub, LinkedIn)                                                                             |
| WebSockets           | Socket.io (single-node)                                                                                                 |
| Email                | [Resend](https://resend.com) + [React Email](https://react.email)                                                       |
| AI                   | [Vercel AI SDK](https://sdk.vercel.ai) (Gemini, Groq, OpenRouter)                                                       |
| File Storage         | AWS S3                                                                                                                  |
| API Docs             | Swagger + [Scalar](https://scalar.com)                                                                                  |
| Logging              | [@arkv/nestjs-context-logger](https://www.npmjs.com/package/@arkv/nestjs-context-logger) (structured, async-context)    |
| Admin CMS            | [@arkv/nestjs-cms](https://www.npmjs.com/package/@arkv/nestjs-cms) (OpenAPI-driven admin UI)                            |
| Build                | Bun-native transpile (`scripts/build.ts`)                                                                               |
| Linting & Formatting | [Oxlint](https://oxc.rs) (type-aware) + [oxfmt](https://oxc.rs)                                                         |
| Testing              | Bun test runner                                                                                                         |

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

That's it — the app is SQLite-first and needs no Postgres, Redis, or Docker to run locally.

## Quick Start

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env as needed (see env-vars.md). Defaults work out of the box.

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

- JWT-based authentication with configurable expiration
- OAuth2 providers: Google, GitHub, LinkedIn
- OAuth account linking (multiple providers per user)
- Role-based access control (RBAC) with `admin` and `user` roles
- Password reset flow with email tokens
- Invite-based registration

### Database & ORM

- **Drizzle ORM over `bun:sqlite`** — fully **synchronous** data access (no `await` on queries)
- Automatic `casing: 'snake_case'` mapping (camelCase properties → snake_case columns)
- **Boot-time migrator** — migrations auto-apply on startup, so a fresh SQLite file is always schema-current
- Timestamps as integer epoch-ms, JSON columns via `text({ mode: 'json' })`, `$inferSelect`/`$inferInsert` row types
- Explicit, readable index/constraint names in the schema files
- Automatic **audit logging via SQLite triggers** (not application code) — old/new JSON snapshots written to `audit_log`
- `postgres` reserved as a future async data layer (config surface present; the module throws if selected)

### Job Queue System

- **bunqueue** — each queue is an embedded, SQLite-persisted, in-process instance (no Redis, no BullMQ)
- Declarative `@JobHandler()` decorator for job routing
- Auto-discovery of handlers via NestJS `DiscoveryService`
- Lightweight queue dashboard at `/api/queues` (+ `/api/queues/stats` JSON)
- Configurable concurrency, retries with exponential backoff, per-job timeout, and rate limiting

### Real-time Communication

- Socket.io WebSocket gateway with JWT authentication
- Single-node, in-memory adapter (shares the HTTP server by default)
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
- Schema endpoint at `/cms/schema`; logs in against this API via the documented `/api/auth/login` endpoint
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

### Rate Limiting

- In-memory `@nestjs/throttler` (single-node, no Redis)
- Three-tier throttling: short (10/1s), medium (50/10s), long (300/60s) — skipped for authenticated users
- Environment-aware `@EnvThrottle()` decorator

### Developer Experience

- Type-aware Oxlint for linting and oxfmt for formatting
- TypeScript 7 (`tsgo`, the native-preview compiler) for fast typechecking
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
bun run typecheck                         # Typecheck with tsgo (TypeScript 7)

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
├── infra/                 # Infrastructure (db, queue, throttler, health)
├── auth/                  # Authentication (JWT, OAuth strategies, guards)
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

| Route                                    | Description                         |
| ---------------------------------------- | ----------------------------------- |
| `POST /api/auth/login`                   | Email/password login                |
| `POST /api/auth/register`                | User registration                   |
| `POST /api/auth/forgotten-password`      | Request password reset              |
| `POST /api/auth/password-reset`          | Reset password                      |
| `GET /api/auth/{google,github,linkedin}` | OAuth login                         |
| `GET /api/users`                         | List users (cursor paginated)       |
| `GET /api/users/invites`                 | Manage invites                      |
| `POST /api/ai/query`                     | AI query                            |
| `GET /api/ai/models`                     | List AI models                      |
| `POST /api/files`                        | Upload file                         |
| `GET /api/files`                         | List files (cursor paginated)       |
| `GET /api/audit`                         | Query audit logs (cursor paginated) |
| `GET /api/service/health`                | Health check (DB, memory)           |
| `GET /api/service/up`                    | Uptime check                        |
| `GET /api/service/config`                | Service configuration               |
| `GET /api/queues`                        | Queue dashboard (bunqueue stats)    |
| `GET /cms`                               | Admin CMS UI (OpenAPI-driven)       |

## Documentation

- **API Docs**: Swagger UI at `/api/docs` + Scalar at `/api/public` (when running)
- **Admin CMS**: OpenAPI-driven admin UI at `/cms`
- **Environment Variables**: See [env-vars.md](./env-vars.md) for the full configuration reference

## Docker

SQLite-first — the container runs standalone with no companion database/cache services.

```bash
cp .env.example .env.full                 # Setup env
docker compose -f docker-compose.full.yml --env-file .env.full up -d    # Start
docker compose -f docker-compose.full.yml --env-file .env.full down     # Stop
```

The SQLite database and bunqueue storage persist in the `app-data` volume (`/app/data`). To rebuild the backend:

```bash
docker compose -f docker-compose.full.yml --env-file .env.full build --no-cache app-backend-full
docker compose -f docker-compose.full.yml --env-file .env.full up -d app-backend-full
```

## License

MIT
