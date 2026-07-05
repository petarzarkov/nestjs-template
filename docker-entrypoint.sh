#!/bin/sh
set -e

# Schema migrations (and audit triggers) are applied automatically on boot by
# the app itself (see src/infra/db/client.ts) — no separate migration step.
echo "Starting NestJS template service (NODE_ENV: $NODE_ENV)..."
exec "$@"
