import { integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Shared SQLite column builders. Column names are derived from the property
 * key via the drizzle instance's `casing: 'snake_case'` setting, so callers
 * pass no name argument.
 */

/** UUID primary key, generated application-side (crypto.randomUUID). */
export const uuidPk = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Millisecond-precision timestamp stored as an integer, returned as a Date. */
export const timestampMs = () => integer({ mode: 'timestamp_ms' });

/** created_at: set once on insert. */
export const createdAt = () =>
  timestampMs()
    .notNull()
    .$defaultFn(() => new Date());

/** updated_at: set on insert, bumped on every drizzle update. */
export const updatedAt = () =>
  timestampMs()
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());
