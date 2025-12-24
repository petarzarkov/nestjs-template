# Environment Variables

This document outlines the environment variables required for the project. These are defined in `.env.example` files and should be configured in local `.env` files for development.

> **Note**: Make sure to create corresponding `.env` files in the same directories.

### PostgreSQL Database

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `POSTGRES_DATA_DIR` | No description provided. | `.tmp/postgres_data` | .env.example |
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
| `REDIS_CACHE_ENABLED` | Enable Redis-backed caching (CacheInterceptor) | `true` | .env.example |
| `REDIS_THROTTLE_ENABLED` | Enable Redis-backed rate limiting (ThrottlerGuard) | `true` | .env.example |
| `REDIS_THROTTLE_TTL` | Throttle time window in ms (default: 60000 = 60s) | `60000` | .env.example |
| `REDIS_THROTTLE_LIMIT` | Max requests per TTL (default: 100) | `100` | .env.example |
| `REDIS_WS_ADAPTER_ENABLED` | Enable Redis adapter for Socket.io (multi-instance support) | `true` | .env.example |
| `REDIS_PUBSUB_ENABLED` | Enable Redis pub/sub for event system | `true` | .env.example |

### Email

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `EMAIL_API_KEY` | Your API key for the service. | `testestsetst` | .env.example |
| `EMAIL_SENDER` | The "From" address for outgoing emails. | `'App Dev <dev@resend.dev.com>'` | .env.example |
| `EMAIL_ADMIN` | No description provided. | `admin@dev.com` | .env.example |

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

### WebSocket

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `WS_PORT` | No description provided. | `2999` | .env.example |
| `WS_PATH` | No description provided. | `/ws` | .env.example |
| `WS_TRANSPORTS` | No description provided. | `'websocket'` | .env.example |

### HTTP Client

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `HTTP_REQ_TIMEOUT` | The timeout for outgoing HTTP requests, in milliseconds. | `10000` | .env.example |
| `HTTP_REQ_MAX_REDIRECTS` | The maximum number of redirects to follow for an HTTP request. | `5` | .env.example |

### General

| Variable | Description | Default Value | Source |
|---|---|---|---|
| `NODE_ENV` | # The current service environment (e.g., development, staging, production). | `development` | .env.example |
| `CORS_ORIGIN` | wildcard for dev | `'*'` | .env.example |
| `TZ` | No description provided. | `UTC` | .env.example |

