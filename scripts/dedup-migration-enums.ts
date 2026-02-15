/**
 * Post-processor for TypeORM migrations.
 *
 * Fixes two known TypeORM bugs with enum types:
 * 1. Duplicate CREATE TYPE / DROP TYPE when multiple entities share the same enumName
 * 2. Phantom enum recreation diffs (RENAME → CREATE → ALTER COLUMN → DROP old)
 *    generated even when enum values haven't changed
 *
 * Usage: bun ./scripts/dedup-migration-enums.ts <migration-file-path>
 */

import { unlink } from 'node:fs/promises';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: bun ./scripts/dedup-migration-enums.ts <file>');
  process.exit(1);
}

const file = Bun.file(filePath);
const content = await file.text();

let result = content;
let modified = false;

// --- Fix 1: Remove duplicate CREATE TYPE / DROP TYPE for shared enumName ---

function dedup(source: string, regex: RegExp, label: string): string {
  const seen = new Set<string>();
  let removed = 0;

  const output = source.replace(regex, (match, enumName: string) => {
    if (seen.has(enumName)) {
      removed++;
      return '';
    }
    seen.add(enumName);
    return match;
  });

  if (removed > 0) {
    console.log(`  Removed ${removed} duplicate ${label} statement(s)`);
    modified = true;
  }

  return output;
}

const createTypeRegex =
  /await queryRunner\.query\(\s*`CREATE TYPE "public"\."([^"]+)" AS ENUM\([^)]+\)`,?\s*\);/g;
const dropTypeRegex =
  /await queryRunner\.query\(\s*`DROP TYPE "public"\."([^"]+)"`,?\s*\);/g;

result = dedup(result, createTypeRegex, 'CREATE TYPE');
result = dedup(result, dropTypeRegex, 'DROP TYPE');

// --- Fix 2: Remove phantom enum recreation blocks ---
// TypeORM generates these when it can't properly compare enum metadata:
//   RENAME "X" TO "X_old" → CREATE "X" → ALTER COLUMN TYPE → DROP "X_old"
// If the enum values are identical, the whole block is a no-op.

const phantomEnumPattern =
  /\s*await queryRunner\.query\(\s*`ALTER TYPE "public"\."([^"]+)" RENAME TO "\1_old"`,?\s*\);\s*await queryRunner\.query\(\s*`CREATE TYPE "public"\."\1" AS ENUM\(([^)]+)\)`,?\s*\);\s*(?:await queryRunner\.query\(\s*`ALTER TABLE "[^"]+" ALTER COLUMN "[^"]+" (?:DROP DEFAULT|TYPE "public"\."\1"[^`]*|SET DEFAULT[^`]*)`,?\s*\);\s*)*await queryRunner\.query\(\s*`DROP TYPE "public"\."\1_old"`,?\s*\);/g;

let phantomCount = 0;
result = result.replace(phantomEnumPattern, () => {
  phantomCount++;
  return '';
});

if (phantomCount > 0) {
  console.log(`  Removed ${phantomCount} phantom enum recreation block(s)`);
  modified = true;
}

// Also remove the reverse pattern in down() methods:
//   CREATE "X_old" → ALTER COLUMN TYPE "X_old" → DROP "X" → RENAME "X_old" TO "X"
const phantomEnumDownPattern =
  /\s*await queryRunner\.query\(\s*`CREATE TYPE "public"\."([^"]+)_old" AS ENUM\(([^)]+)\)`,?\s*\);\s*(?:await queryRunner\.query\(\s*`ALTER TABLE "[^"]+" ALTER COLUMN "[^"]+" (?:DROP DEFAULT|TYPE "public"\."\1_old"[^`]*|SET DEFAULT[^`]*)`,?\s*\);\s*)*await queryRunner\.query\(\s*`DROP TYPE "public"\."\1"`,?\s*\);\s*await queryRunner\.query\(\s*`ALTER TYPE "public"\."\1_old" RENAME TO "\1"`,?\s*\);/g;

let phantomDownCount = 0;
result = result.replace(phantomEnumDownPattern, () => {
  phantomDownCount++;
  return '';
});

if (phantomDownCount > 0) {
  console.log(
    `  Removed ${phantomDownCount} phantom enum recreation block(s) in down()`,
  );
  modified = true;
}

// --- Clean up ---

// Remove blank lines left behind (3+ consecutive newlines → 2)
result = result.replace(/\n{3,}/g, '\n\n');

// Check if the migration is now empty (only has empty up/down methods)
const emptyMigrationPattern =
  /public async up\(queryRunner: QueryRunner\): Promise<void>\s*\{\s*\}\s*public async down\(queryRunner: QueryRunner\): Promise<void>\s*\{\s*\}/;

if (emptyMigrationPattern.test(result)) {
  await unlink(filePath);
  console.log('🗑️  Migration was entirely phantom diffs — deleted empty file');
  process.exit(0);
}

if (modified) {
  await Bun.write(filePath, result);
  console.log('✅ Fixed TypeORM enum issues in migration');
} else {
  console.log('✅ No enum issues found');
}
