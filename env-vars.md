# Environment Variables

This document outlines the environment variables required for the project. These are defined in `.env.example` files and should be configured in local `.env` files for development.

> **Note**: Make sure to create corresponding `.env` files in the same directories.

### Database

| Variable         | Description                                            | Default Value                                              | Source       |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------- | ------------ | ------------ |
| `DB_TYPE`        | sqlite                                                 | postgres (postgres reserved for a future async data layer) | `sqlite`     | .env.example |
| `SQLITE_DB_PATH` | SQLite file (auto-created; migrations applied on boot) | `./data/app.db`                                            | .env.example |

### Queue

| Variable                    | Description                                  | Default Value  | Source       |
| --------------------------- | -------------------------------------------- | -------------- | ------------ |
| `QUEUE_DATA_PATH`           | bunqueue storage directory                   | `./data/queue` | .env.example |
| `QUEUE_CONCURRENCY`         | Jobs processed concurrently (>=1)            | `5`            | .env.example |
| `QUEUE_MAX_RETRIES`         | Retry attempts for failed jobs               | `3`            | .env.example |
| `QUEUE_RETRY_DELAY_MS`      | Base retry delay in ms (exponential backoff) | `1000`         | .env.example |
| `QUEUE_JOB_TIMEOUT_MS`      | Per-job execution timeout in ms              | `30000`        | .env.example |
| `QUEUE_RATE_LIMIT_MAX`      | Max jobs per rate window                     | `100`          | .env.example |
| `QUEUE_RATE_LIMIT_DURATION` | Rate window in ms                            | `1000`         | .env.example |

### Email

| Variable        | Description                             | Default Value                    | Source       |
| --------------- | --------------------------------------- | -------------------------------- | ------------ |
| `EMAIL_API_KEY` | Your API key for the service.           | `testestsetst`                   | .env.example |
| `EMAIL_SENDER`  | The "From" address for outgoing emails. | `'App Dev <dev@resend.dev.com>'` | .env.example |
| `EMAIL_ADMIN`   | No description provided.                | `admin@dev.com`                  | .env.example |

### AWS

| Variable                | Description                                 | Default Value        | Source       |
| ----------------------- | ------------------------------------------- | -------------------- | ------------ |
| `AWS_S3_BUCKET_NAME`    | No description provided.                    | `dev-test`           | .env.example |
| `AWS_REGION`            | No description provided.                    | `eu-west-1`          | .env.example |
| `AWS_ACCESS_KEY_ID`     | Optional, can be used for local dev testing | `awsaccesskeyid`     | .env.example |
| `AWS_SECRET_ACCESS_KEY` | Optional, can be used for local dev testing | `awssecretaccesskey` | .env.example |

### Application & API

| Variable                | Description                                                                             | Default Value                                                                             | Source       |
| ----------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------ |
| `APP_ENV`               | The current application environment (e.g., dev, stage, prod).                           | `local`                                                                                   | .env.example |
| `API_PORT`              | No description provided.                                                                | `3011`                                                                                    | .env.example |
| `LOG_LEVEL`             | Sets the minimum log level (VERBOSE, DEBUG, LOG, WARN, ERROR, FATAL)                    | `'debug'`                                                                                 | .env.example |
| `LOG_MASK_FIELDS`       | Comma-separated list of fields to mask in logs                                          | `'accessToken,jwt,password,secret,phone'`                                                 | .env.example |
| `LOG_FILTER_EVENTS`     | Comma-separated list of events to fully exclude from logging e.g. '/api/service/health' | `'/api/service/health,/api/service/config,/api/service/up,/api/queues,/api/queues/stats'` | .env.example |
| `LOG_MAX_ARRAY_LENGTH`  | Maximum number of array items to include in logs before truncating                      | `1`                                                                                       | .env.example |
| `AI_GEMINI_API_KEY`     | No description provided.                                                                | `your_gemini_api_key`                                                                     | .env.example |
| `AI_GROQ_API_KEY`       | No description provided.                                                                | `your_groq_api_key`                                                                       | .env.example |
| `AI_OPENROUTER_API_KEY` | No description provided.                                                                | `your_openrouter_api_key`                                                                 | .env.example |

### Security & JWT

| Variable         | Description                                                     | Default Value                  | Source       |
| ---------------- | --------------------------------------------------------------- | ------------------------------ | ------------ |
| `JWT_EXPIRATION` | The expiration time for JWTs, in seconds (e.g., 3600 = 1 hour). | `3600`                         | .env.example |
| `JWT_SECRET`     | No description provided.                                        | `dalfkko42fo2fok24fo2f4k0fsfd` | .env.example |

### WebSocket

| Variable        | Description              | Default Value | Source       |
| --------------- | ------------------------ | ------------- | ------------ |
| `WS_PATH`       | No description provided. | `/ws`         | .env.example |
| `WS_TRANSPORTS` | No description provided. | `'websocket'` | .env.example |

### HTTP Client

| Variable                 | Description                                                    | Default Value | Source       |
| ------------------------ | -------------------------------------------------------------- | ------------- | ------------ |
| `HTTP_REQ_TIMEOUT`       | The timeout for outgoing HTTP requests, in milliseconds.       | `10000`       | .env.example |
| `HTTP_REQ_MAX_REDIRECTS` | The maximum number of redirects to follow for an HTTP request. | `5`           | .env.example |

### OAuth

| Variable                       | Description                       | Default Value                 | Source       |
| ------------------------------ | --------------------------------- | ----------------------------- | ------------ |
| `GOOGLE_OAUTH_CLIENT_ID`       | Your Google OAuth client ID.      | `your_google_client_id`       | .env.example |
| `GOOGLE_OAUTH_CLIENT_SECRET`   | Your Google OAuth client secret.  | `your_google_client_secret`   | .env.example |
| `GITHUB_OAUTH_CLIENT_ID`       | Your GitHub OAuth client ID.      | `your_github_client_id`       | .env.example |
| `GITHUB_OAUTH_CLIENT_SECRET`   | Your GitHub OAuth client secret.  | `your_github_client_secret`   | .env.example |
| `LINKEDIN_OAUTH_CLIENT_ID`     | Your LinkedIn OAuth client ID.    | `your_linkedin_client_id`     | .env.example |
| `LINKEDIN_OAUTH_CLIENT_SECRET` | Your LinkedIn OAuth client secret | `your_linkedin_client_secret` | .env.example |

### AI

| Variable                 | Description              | Default Value | Source       |
| ------------------------ | ------------------------ | ------------- | ------------ |
| `AI_STREAM_TIMEOUT`      | No description provided. | `10000`       | .env.example |
| `AI_DEFAULT_TEMPERATURE` | No description provided. | `0.9`         | .env.example |

### General

| Variable           | Description                                                                                     | Default Value                          | Source       |
| ------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- | ------------ |
| `NODE_ENV`         | The current service environment (e.g., development, staging, production).                       | `development`                          | .env.example |
| `BASIC_AUTH_TOKEN` | (Optional) A unique secret key for signing JWTs. Should be a long, random string in production. | `8ddba558-22f5-467c-9d98-6189fe54e9b4` | .env.example |
| `CORS_ORIGIN`      | wildcard for dev                                                                                | `'*'`                                  | .env.example |
| `TZ`               | No description provided.                                                                        | `UTC`                                  | .env.example |
