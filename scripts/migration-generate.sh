#!/bin/bash
set -e

# Check if a migration name was provided
if [ -z "$1" ]; then
  echo "❌ Error: Please provide a name for the migration."
  echo "Usage: pnpm migration:generate <MigrationName>"
  exit 1
fi
# Print current working directory
echo "✅ Current working directory: $(pwd)"

# The original name from the first argument
ORIGINAL_NAME=$1

# Convert the name to kebab-case
# 1. Use sed to put an underscore before any capital letter that follows a lowercase letter.
# 2. Use tr to convert the whole string to lowercase.
# 3. Use tr to replace all underscores with hyphens.
KEBAB_CASE_NAME=$(echo "$ORIGINAL_NAME" | \
  sed -E 's/([a-z])([A-Z])/\1_\2/g' | \
  tr '[:upper:]' '[:lower:]' | \
  tr '_' '-')

# The full path for the TypeORM CLI command using the formatted name
MIGRATION_PATH="./src/db/migrations/$KEBAB_CASE_NAME"

echo "✅ Formatting name to: '$KEBAB_CASE_NAME'"
echo "✅ Generating migration at: $MIGRATION_PATH"

# Run the typeorm command, passing the constructed path
pnpm typeorm migration:generate "$MIGRATION_PATH"