#!/bin/sh
set -e

echo "Running database migrations for NODE_ENV: $NODE_ENV template service"

if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "testing" ]; then
  bun run mig:run:prod
else
  bun run mig:run
fi

echo "Migrations completed. Starting application..."
exec "$@"