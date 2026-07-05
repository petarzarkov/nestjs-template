import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { AuditAction } from '@/audit/enum/audit-action.enum';
import { auditLog } from '@/audit/schema/audit-log.schema';
import { createDrizzleClient, type DrizzleDB } from '@/infra/db/client';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import { invites } from '@/users/invites/schema/invite.schema';
import { UserRole } from '@/users/enum/user-role.enum';
import { users } from '@/users/schema/user.schema';

/**
 * Integration test for the SQLite audit triggers (`src/infra/db/triggers.ts`).
 *
 * Unlike a unit test, this boots a real (in-memory) SQLite database via
 * `createDrizzleClient(':memory:')` — the exact same code path the app runs on
 * boot, so migrations AND the audit triggers are applied. We then drive real
 * INSERT/UPDATE/DELETE statements and assert the triggers populate `audit_log`.
 * This behavior lives entirely in the database and cannot be exercised with a
 * mocked repository.
 */
describe('audit triggers (integration, in-memory SQLite)', () => {
  let db: DrizzleDB;
  let sqlite: Database;

  beforeEach(() => {
    // Fresh, isolated database per test.
    ({ db, sqlite } = createDrizzleClient(':memory:'));
  });

  afterEach(() => {
    sqlite.close();
  });

  const insertUser = (overrides: { email?: string; password?: string } = {}) =>
    db
      .insert(users)
      .values({
        email: overrides.email ?? 'user@test.dev',
        password: overrides.password,
        roles: [UserRole.USER],
      })
      .returning()
      .get();

  const auditRowsFor = (entityId: string) =>
    db.select().from(auditLog).where(eq(auditLog.entityId, entityId)).all();

  it('writes an INSERT snapshot when a user is created', () => {
    const user = insertUser({ email: 'insert@test.dev' });

    const rows = auditRowsFor(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe(AuditAction.INSERT);
    expect(rows[0].entityName).toBe('User');
    expect(rows[0].oldValue).toBeNull();
    expect(rows[0].newValue).toMatchObject({ email: 'insert@test.dev' });
  });

  it('never leaks the password into audit snapshots', () => {
    const user = insertUser({
      email: 'secret@test.dev',
      password: 'super-secret-hash',
    });

    const [row] = auditRowsFor(user.id);
    expect(row.newValue).not.toHaveProperty('password');
    expect(JSON.stringify(row.newValue)).not.toContain('super-secret-hash');
  });

  it('writes an UPDATE snapshot with both old and new values', () => {
    const user = insertUser();

    db.update(users)
      .set({ suspended: true })
      .where(eq(users.id, user.id))
      .run();

    const rows = auditRowsFor(user.id);
    expect(rows.map(r => r.action)).toContain(AuditAction.UPDATE);

    const update = rows.find(r => r.action === AuditAction.UPDATE);
    // `suspended` is stored as 0/1 but emitted as a JSON boolean by the trigger.
    expect(update?.oldValue).toMatchObject({ suspended: false });
    expect(update?.newValue).toMatchObject({ suspended: true });
  });

  it('writes a DELETE snapshot with only the old value', () => {
    const user = insertUser();

    db.delete(users).where(eq(users.id, user.id)).run();

    const del = auditRowsFor(user.id).find(
      r => r.action === AuditAction.DELETE,
    );
    expect(del).toBeDefined();
    expect(del?.oldValue).toMatchObject({ id: user.id });
    expect(del?.newValue).toBeNull();
  });

  it('attributes the actor from the _audit_ctx row', () => {
    // In production the AuditContextInterceptor sets this per request; here we
    // set it directly to prove the trigger reads actor_id from _audit_ctx.
    sqlite.exec("UPDATE _audit_ctx SET actor_id = 'actor-123' WHERE id = 1");

    const user = insertUser();

    const [row] = auditRowsFor(user.id);
    expect(row.actorId).toBe('actor-123');
  });

  it('also audits the invite table', () => {
    const invite = db
      .insert(invites)
      .values({
        email: 'invitee@test.dev',
        inviteCode: 'INVITE-CODE-1',
        role: UserRole.USER,
        status: InviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning()
      .get();

    const [row] = auditRowsFor(invite.id);
    expect(row.entityName).toBe('Invite');
    expect(row.action).toBe(AuditAction.INSERT);
    expect(row.newValue).toMatchObject({ email: 'invitee@test.dev' });
  });
});
