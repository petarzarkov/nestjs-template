# NestJS Template

A production-ready NestJS monolith template with TypeScript, Drizzle ORM, and modern tooling.

## Architecture

- **Modular Monolith**: Clean module boundaries without microservices complexity
- **Type Safety**: End-to-end type safety from DB schema to API
- **Recovery-Oriented**: Database-first design with PostgreSQL persistence
- **Modern Stack**: Node.js 22+, NestJS 11, Drizzle ORM, TypeScript

## Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Docker (for PostgreSQL and Redis)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

## Scripts

```bash
pnpm dev              # Development with hot reload
pnpm build            # Build for production
pnpm start            # Start production build
pnpm test             # Run tests (Node.js native runner)
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Lint code
pnpm format           # Format code
pnpm db:generate      # Generate migrations
pnpm db:push          # Apply migrations
pnpm db:studio        # Open Drizzle Studio
```

## Core Features

- **Database**: Drizzle ORM with PostgreSQL
- **Logging**: Structured JSON logging with context
- **Config**: Type-safe environment configuration
- **Validation**: Class-validator with custom decorators
- **API Docs**: Swagger/OpenAPI integration
- **Health Checks**: Terminus health monitoring
- **Testing**: Node.js native test runner with TypeScript support

## Project Structure

```
src/
├── config/          # Environment configuration
├── core/            # Shared decorators, filters, interceptors
├── database/        # Drizzle schema and migrations
├── health/          # Health check endpoints
├── logger/          # Logging service
└── swagger/         # API documentation setup
```
