# NestJS Template

A production-ready NestJS monolith template with TypeScript, TypeORM, and modern tooling.

## Architecture

- **Modular Monolith**: Clean module boundaries without microservices complexity
- **Type Safety**: End-to-end type safety from DB schema to API
- **Recovery-Oriented**: Database-first design with PostgreSQL persistence
- **Modern Stack**: Bun runtime, NestJS 11, TypeORM, TypeScript

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
bun run lint                # Lint code
bun run format              # Format code
bun run migration:gen $Name # Generate migration
bun run migration:run       # Run migrations
bun run migration:revert    # Revert last migration
bun run db:drop             # Drop db schema
```

## Core Features

- **Database**: TypeORM with PostgreSQL
- **Authentication**: JWT-based auth with Passport strategies
- **Authorization**: Role-based access control (RBAC)
- **Logging**: Structured JSON logging with context
- **Config**: Type-safe environment configuration
- **Validation**: Class-validator with custom decorators
- **Pagination**: Reusable pagination factory
- **API Docs**: Swagger/OpenAPI integration
- **Health Checks**: Terminus health monitoring
- **Testing**: Bun's built-in test runner with TypeScript support

## Project Structure

```bash
src/
├── auth/            # Authentication & authorization
├── config/          # Environment configuration
├── core/            # Shared decorators, filters, interceptors, pagination
├── db/              # TypeORM data source and migrations
├── health/          # Health check endpoints
├── logger/          # Logging service
├── swagger/         # API documentation setup
└── users/           # User management and invites
```
