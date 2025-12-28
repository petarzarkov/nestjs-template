# NestJS Template

A production-ready NestJS monolith template with Bun, Biome, TypeScript, TypeORM, and modern tooling.

## Architecture

- **Modular Monolith**: Clean module boundaries without microservices complexity
- **Type Safety**: End-to-end type safety from DB schema to API
- **Recovery-Oriented**: Database-first design with PostgreSQL persistence
- **Modern Stack**: Bun, NestJS, TypeORM, BullMQ, TypeScript, Biome, React Emails

## Prerequisites

- Bun >= 1.0.0
- Docker (for PostgreSQL and Redis)

## Quick Start

```bash
# Install dependencies
bun install

# Start infrastructure
docker compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your configuration
# See env-vars.md for detailed configuration options

# Run database migrations
bun run migration:run

# Start development server
bun dev
```

## Scripts

```bash
bun dev                     # Development with hot reload
bun run build               # Build for production
bun start                   # Start production build
bun test                    # Run unit tests (Bun test runner)
bun test --watch            # Run tests in watch mode
bun run test:e2e            # Run e2e tests
bun run email               # Run email server
bun run email:export        # Export email templates
bun run lint                # Lint code
bun run format              # Format code
bun run migration:gen $Name # Generate migration
bun run migration:run       # Run migrations
bun run migration:revert    # Revert last migration
bun run db:drop             # Drop db schema
bun run create:admin        # Create a new admin user
```

## Core Features

- **Database**: TypeORM with PostgreSQL
- **Authentication**:
  - JWT-based auth
  - Strategies: Local, Google, GitHub, LinkedIn
  - OAuth account linking
- **Authorization**: Role-based access control (RBAC)
- **Logging**: Structured JSON logging with context
- **Config**: Type-safe environment configuration (validated via class-validator)
- **Validation**: Class-validator with custom decorators
- **Pagination**: Reusable pagination factory
- **API Docs**: Swagger/OpenAPI integration
- **Health Checks**: Terminus health monitoring
  - db health check
  - redis health check
  - memory health check
- **Redis**: Redis integration for caching, throttling, and job queues
- **Testing**: Bun's built-in test runner with TypeScript support
- **WebSockets**: Socket.io gateway with authentication
- **Email**: React Email templates with Resend
- **Integrations**:
  - **Slack**: Global service for sending structured notifications/alerts
- **Helpers**:
  - Resilient external API caller with retries, backoff & jitter
  - URL building and manipulation utilities

## Redis Features

Redis is required for the application to run and provides the following features:

| Feature               | Description                                        |
| --------------------- | -------------------------------------------------- |
| **Caching**           | Global `CacheInterceptor` with Redis store         |
| **Throttling**        | Global `ThrottlerGuard` with Redis storage         |
| **WebSocket Adapter** | Socket.io Redis adapter for multi-instance support |
| **Job Queues**        | BullMQ queues for background job processing        |

### Job Queue System

Background jobs are processed via BullMQ queues using `@nestjs/bullmq`:

**Published Events:**
- `user.registered` - When a new user registers (direct or via invite)
- `user.invited` - When an invite is created
- `user.password_reset` - When a password reset is requested

**Queue Processing:**
- Jobs are handled by `NotificationProcessor` using `@Processor()` decorator
- Event handlers use `@OnWorkerEvent()` decorators for lifecycle hooks
- Configurable concurrency and rate limiting via BullMQ options
- Failed jobs automatically retry with exponential backoff
- Jobs are persisted in Redis for durability and crash recovery

**Actions:**
- Sends appropriate emails via `EmailService`
- Emits WebSocket notifications via `EventsGateway`

## Project Structure

```bash
src/
├── auth/            # Authentication (Stratgies, Guards) & authorization
├── config/          # Environment configuration
├── core/            # Shared decorators, filters, interceptors, pagination
├── db/              # TypeORM data source and migrations
├── health/          # Health check endpoints
├── helpers/         # Utility services (External APIs, URLs, etc.)
├── logger/          # Logging service
├── notifications/   # Email, WebSocket gateway, event handlers
├── redis/           # Redis module (caching, throttling, pub/sub)
├── slack/           # Slack integration module
├── swagger/         # API documentation setup
└── users/           # User management and invites
```

## Health Endpoints

- `GET /api/service/health` - Full health check (DB, memory, Redis if configured)
- `GET /api/service/up` - Simple uptime check
- `GET /api/service/config` - Service configuration and Redis feature status

## Documentation

For a detailed list of all environment variables and their descriptions, please refer to [env-vars.md](./env-vars.md).
