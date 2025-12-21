import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// example schema
export const appState = pgTable('app_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(), // e.g., 'scalper-v1', 'risk-guard'
  memory: jsonb('memory').notNull(), // Flexible storage for app state
  lastHeartbeat: timestamp('last_heartbeat').defaultNow(),
  isActive: boolean('is_active').default(true),
});
