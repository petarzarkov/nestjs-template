# Environment Variables

This document outlines the environment variables required for the project. These are defined in `.env.example` files and should be configured in local `.env` files for development.

> **Note**: Make sure to create corresponding `.env` files in the same directories.

### PostgreSQL Database

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `POSTGRES_HOST` | No description provided. | `localhost` | .env.example |
| `POSTGRES_PORT` | No description provided. | `5438` | .env.example |
| `POSTGRES_USER` | No description provided. | `postgres` | .env.example |
| `POSTGRES_PASSWORD` | No description provided. | `postgres` | .env.example |
| `POSTGRES_DB` | No description provided. | `pgdb` | .env.example |
| `POSTGRES_USE_SSL` | No description provided. | `false` | .env.example |

### Redis

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `REDIS_HOST` | No description provided. | `localhost` | .env.example |
| `REDIS_PORT` | No description provided. | `6383` | .env.example |

### Application & API

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `APP_ENV` | The current application environment (e.g., dev, stage, prod). | `local` | .env.example |
| `API_PORT` | No description provided. | `2999` | .env.example |
| `LOG_LEVEL` | Sets the minimum log level (VERBOSE, DEBUG, LOG, WARN, ERROR, FATAL) | `'debug'` | .env.example |
| `LOG_MASK_FIELDS` | Comma-separated list of fields to mask in logs | `'accessToken,jwt,password,secret,phone'` | .env.example |
| `LOG_FILTER_EVENTS` | Comma-separated list of events to fully exclude from logging e.g. '/api/service/health' | `'/api/service/health,/api/service/config,/api/service/up'` | .env.example |
| `LOG_MAX_ARRAY_LENGTH` | Maximum number of array items to include in logs before truncating | `1` | .env.example |

### Security & JWT

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `JWT_EXPIRATION` | The expiration time for JWTs, in seconds (e.g., 3600 = 1 hour). | `3600` | .env.example |

### General

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `NODE_ENV` | # The current service environment (e.g., development, staging, production). | `development` | .env.example |

