# NestJS Template

A production-ready NestJS monolith template with TypeScript, TypeORM, and modern tooling.

## Architecture

- **Modular Monolith**: Clean module boundaries without microservices complexity
- **Type Safety**: End-to-end type safety from DB schema to API
- **Recovery-Oriented**: Database-first design with PostgreSQL persistence
- **Modern Stack**: Node.js 22+, NestJS 11, TypeORM, TypeScript

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
pnpm migration:run

# Start development server
pnpm dev
```

## Scripts

```bash
pnpm dev                    # Development with hot reload
pnpm build                  # Build for production
pnpm start                  # Start production build
pnpm test                   # Run unit tests (Node.js native runner)
pnpm test:watch             # Run tests in watch mode
pnpm test:e2e               # Run e2e tests
pnpm lint                   # Lint code
pnpm format                 # Format code
pnpm migration:gen          # Generate migration
pnpm migration:run          # Run migrations
pnpm migration:revert        # Revert last migration
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
- **Testing**: Node.js native test runner with TypeScript support

## Project Structure

```
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
