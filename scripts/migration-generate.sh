#!/bin/bash
set -e

MIGRATIONS_DIR="./src/db/migrations"

# Check if a migration name was provided
if [ -z "$1" ]; then
  echo "❌ Error: Please provide a name for the migration."
  echo "Usage: bun run migration:gen <MigrationName>"
  exit 1
fi

echo "✅ Current working directory: $(pwd)"

# The original name from the first argument
ORIGINAL_NAME=$1

# Convert the name to kebab-case
KEBAB_CASE_NAME=$(echo "$ORIGINAL_NAME" | \
  sed -E 's/([a-z])([A-Z])/\1_\2/g' | \
  tr '[:upper:]' '[:lower:]' | \
  tr '_' '-')

MIGRATION_PATH="$MIGRATIONS_DIR/$KEBAB_CASE_NAME"

echo "✅ Formatting name to: '$KEBAB_CASE_NAME'"
echo "✅ Generating migration at: $MIGRATION_PATH"

# Run the typeorm command to generate the migration
bun run typeorm migration:generate "$MIGRATION_PATH"

# Format the generated migration
echo "🔧 Formatting migration..."

LATEST_MIGRATION=$(ls -t "$MIGRATIONS_DIR" | head -n 1)

if [ -z "$LATEST_MIGRATION" ]; then
  echo "❌ No migration file found after generation. Exiting."
  exit 1
fi

FILE_PATH="$MIGRATIONS_DIR/$LATEST_MIGRATION"
echo "✅ Formatting SQL in: $FILE_PATH"

# Add /* sql */ hint to queryRunner.query() calls so prettier can format the SQL
awk '{
  gsub(/queryRunner\.query\(`/, "queryRunner.query(/* sql */ `");
  print
}' "$FILE_PATH" > "$FILE_PATH.tmp" && mv "$FILE_PATH.tmp" "$FILE_PATH"

# Run prettier on all migration files
prettier --cache --ignore-unknown --write "$MIGRATIONS_DIR/**/*.ts"

echo "✅ Migration generated and formatted successfully!"