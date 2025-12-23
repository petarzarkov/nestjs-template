#!/bin/bash

MIGRATIONS_DIR="./src/db/migrations"

echo "Finding the latest migration file..."

# Find the most recently created file in the directory
LATEST_MIGRATION=$(ls -t "$MIGRATIONS_DIR" | head -n 1)

if [ -z "$LATEST_MIGRATION" ];
  then
    echo "No migration file found. Exiting."
    exit 1
fi

FILE_PATH="$MIGRATIONS_DIR/$LATEST_MIGRATION"
echo "Formatting SQL in: $FILE_PATH"

# Use awk for a more reliable replacement across platforms (macOS and Linux)
# It finds all instances of `queryRunner.query(` and adds /* sql */ hint so prettier can format the sql.
awk '{
  gsub(/queryRunner\.query\(`/, "queryRunner.query(/* sql */ `");
  print
}' "$FILE_PATH" > "$FILE_PATH.tmp" && mv "$FILE_PATH.tmp" "$FILE_PATH"

prettier --cache --ignore-unknown --write "$MIGRATIONS_DIR/**/*.ts"
echo "Formatting complete."
