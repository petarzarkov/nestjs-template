# NestJS Template

A production-ready NestJS modular monolith template running on **Bun**, with TypeScript, TypeORM, PostgreSQL, Redis, and modern tooling.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Framework | [NestJS 11](https://nestjs.com) |
| Language | TypeScript 5.9 (strict, ESNext) |
| Database | PostgreSQL 17 + [TypeORM](https://typeorm.io) |
| Cache & Queues | Redis 8 + [BullMQ](https://bullmq.io) |
| Auth | Passport.js (JWT, Google, GitHub, LinkedIn) |
| WebSockets | Socket.io with Redis adapter |
| Email | [Resend](https://resend.com) + [React Email](https://react.email) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai) (Gemini, Groq, OpenRouter) |
| File Storage | AWS S3 |
| API Docs | Swagger + [Scalar](https://scalar.com) |
| Linting | [Biome](https://biomejs.dev) |
| Testing | Bun test runner |

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)

## Quick Start

```bash
# Install dependencies
bun install

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your configuration (see env-vars.md for details)

# Run database migrations
bun run mig:run

# Start development server
bun dev
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
- TypeORM with PostgreSQL and automatic snake_case naming
- Migration system with generate, run, and revert commands
- PostgreSQL advisory locks for distributed coordination
- Automatic audit logging via `@Auditable()` entity decorator

### Job Queue System
- BullMQ queues backed by Redis for reliable async processing
- Declarative `@JobHandler()` decorator for job routing
- Auto-discovery of handlers via NestJS `DiscoveryService`
- Bull Board dashboard at `/api/queues`
- Configurable retries with exponential backoff

### Real-time Communication
- Socket.io WebSocket gateway with JWT authentication
- Redis adapter for multi-instance broadcast support
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

### Observability
- Structured JSON logging with `AsyncLocalStorage`-based context
- Request ID propagation (`X-Request-Id` header)
- Sensitive field masking in logs (password, jwt, token, secret)
- Health check endpoints (DB, Redis, memory)
- HTTP request/response logging with timing

### Caching & Rate Limiting
- Redis-backed HTTP cache with configurable TTL
- Three-tier throttling: short (10/1s), medium (50/10s), long (300/60s)

### Developer Experience
- Biome for linting and formatting (single quotes, trailing commas, 80-char lines)
- Husky + lint-staged for pre-commit hooks
- Swagger + Scalar API documentation with optional basic auth
- `bun dev` with hot reload via `bun --watch`

### Integrations
- **Slack**: Bot notifications with rich message formatting
- **AWS S3**: File storage with presigned URL support

## Scripts

```bash
# Development
bun dev                                   # Dev server with hot reload
bun run build                             # Build for production
bun start                                 # Start production build

# Testing
bun test                                  # Run unit tests
bun test --watch                          # Watch mode
bun test --coverage                       # Coverage report
bun run test:e2e                          # Run E2E tests
bun run test:e2e:single ./e2e/path.ts     # Run single E2E test

# Database
bun run mig:gen MyMigration               # Generate migration
bun run mig:run                           # Run migrations
bun run mig:revert                        # Revert last migration
bun run db:drop                           # Drop schema

# Code Quality
bun run lint                              # Lint and fix with Biome
bun run format                            # Format with Biome

# Utilities
bun run create:admin                      # Create admin user
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
├── config/                # Type-safe environment configuration
├── core/                  # Shared utilities (decorators, filters, interceptors, pagination, pipes)
├── infra/                 # Infrastructure (database, redis, queue, logger, health)
├── auth/                  # Authentication (JWT, OAuth strategies, guards)
├── users/                 # User management + invites submodule
├── audit/                 # Automatic entity audit logging
├── file/                  # File upload + S3 storage
├── notifications/         # Email, WebSocket, Slack, queue handlers
└── ai/                    # Multi-provider AI integration

e2e/                       # End-to-end tests
public/                    # Static files (demo chat UI - testing only)
scripts/                   # CLI utilities (migration, admin creation, env docs)
```

## API Endpoints

| Route | Description |
|-------|-------------|
| `POST /api/auth/login` | Email/password login |
| `POST /api/auth/register` | User registration |
| `POST /api/auth/forgotten-password` | Request password reset |
| `POST /api/auth/password-reset` | Reset password |
| `GET /api/auth/{google,github,linkedin}` | OAuth login |
| `GET /api/users` | List users |
| `GET /api/users/invites` | Manage invites |
| `POST /api/ai/query` | AI query |
| `GET /api/ai/models` | List AI models |
| `POST /api/files` | Upload file |
| `GET /api/files` | List files |
| `GET /api/audit` | Query audit logs |
| `GET /api/service/health` | Health check (DB, Redis, memory) |
| `GET /api/service/up` | Uptime check |
| `GET /api/service/config` | Service configuration |
| `GET /api/queues` | Bull Board queue dashboard |

## Health Endpoints

- `GET /api/service/health` — Full health check (DB, memory, Redis)
- `GET /api/service/up` — Simple uptime check
- `GET /api/service/config` — Service configuration and feature status

## Documentation

- **API Docs**: Swagger UI at `/api/docs` + Scalar at `/api/docs/scalar` (when running)
- **Environment Variables**: See [env-vars.md](./env-vars.md) for full configuration reference

## Docker

### Development (infrastructure only)
```bash
docker compose up -d                      # PostgreSQL + Redis
```

### Production (full stack)
```bash
cp .env.example .env.full                 # Setup env
docker compose -f docker-compose.full.yml --env-file .env.full up -d    # Start all
docker compose -f docker-compose.full.yml --env-file .env.full down     # Stop all
```

To rebuild the backend only:
```bash
docker compose -f docker-compose.full.yml --env-file .env.full build --no-cache app-backend-full
docker compose -f docker-compose.full.yml --env-file .env.full up -d app-backend-full
```

## License

MIT
