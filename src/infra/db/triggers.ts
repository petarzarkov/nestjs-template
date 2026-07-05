import type { Database } from 'bun:sqlite';

/**
 * Automatic audit logging via SQLite triggers (replaces the old TypeORM
 * EntitySubscriber). Each audited table gets AFTER INSERT/UPDATE/DELETE
 * triggers that write old/new JSON snapshots into `audit_log`.
 *
 * `actor_id` is read from a single-row `_audit_ctx` table, set per request by
 * {@link AuditContextInterceptor}. Because SQLite uses one shared connection
 * (no per-request session), actor attribution is best-effort under concurrent
 * async requests — the change data itself is always exact.
 */

const UUID = `(lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(abs(random())%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))`;
const NOW = `(cast(unixepoch('subsec')*1000 as integer))`;
const ACTOR = `(select actor_id from _audit_ctx where id = 1)`;

interface AuditedTable {
  /** SQLite table name. */
  table: string;
  /** entity_name recorded in audit_log (matches the DTO class name). */
  entity: string;
  /** Builds the JSON snapshot for a row alias (NEW / OLD), excluding secrets. */
  json: (alias: 'NEW' | 'OLD') => string;
}

const AUDITED_TABLES: AuditedTable[] = [
  {
    table: 'user',
    entity: 'User',
    // password is intentionally excluded from audit snapshots; `suspended` is
    // emitted as a JSON boolean (SQLite stores it as 0/1).
    json: a =>
      `json_object('id',${a}.id,'email',${a}.email,'displayName',${a}.display_name,'picture',${a}.picture,'roles',json(${a}.roles),'suspended',json(iif(${a}.suspended,'true','false')),'createdAt',${a}.created_at,'updatedAt',${a}.updated_at)`,
  },
  {
    table: 'invite',
    entity: 'Invite',
    json: a =>
      `json_object('id',${a}.id,'email',${a}.email,'inviteCode',${a}.invite_code,'role',${a}.role,'status',${a}.status,'expiresAt',${a}.expires_at,'createdAt',${a}.created_at,'updatedAt',${a}.updated_at)`,
  },
];

const insertRow = (
  action: string,
  entity: string,
  oldValue: string,
  newValue: string,
) =>
  `INSERT INTO audit_log (id, actor_id, action, entity_name, entity_id, old_value, new_value, created_at) ` +
  `VALUES (${UUID}, ${ACTOR}, '${action}', '${entity}', ${action === 'DELETE' ? 'OLD' : 'NEW'}.id, ${oldValue}, ${newValue}, ${NOW});`;

const triggersFor = ({ table, entity, json }: AuditedTable): string => `
CREATE TRIGGER IF NOT EXISTS audit_${table}_insert AFTER INSERT ON "${table}"
BEGIN
  ${insertRow('INSERT', entity, 'NULL', json('NEW'))}
END;
CREATE TRIGGER IF NOT EXISTS audit_${table}_update AFTER UPDATE ON "${table}"
BEGIN
  ${insertRow('UPDATE', entity, json('OLD'), json('NEW'))}
END;
CREATE TRIGGER IF NOT EXISTS audit_${table}_delete AFTER DELETE ON "${table}"
BEGIN
  ${insertRow('DELETE', entity, json('OLD'), 'NULL')}
END;`;

/** Idempotently (re)creates the audit context table and triggers. */
export const applyAuditTriggers = (sqlite: Database): void => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _audit_ctx (id INTEGER PRIMARY KEY CHECK (id = 1), actor_id TEXT);
    INSERT OR IGNORE INTO _audit_ctx (id, actor_id) VALUES (1, NULL);
    ${AUDITED_TABLES.map(triggersFor).join('\n')}
  `);
};
