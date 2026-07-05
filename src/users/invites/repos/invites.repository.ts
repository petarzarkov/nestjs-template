import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { Invite } from '../entity/invite.entity';
import { InviteStatus } from '../enum/invite-status.enum';
import { type NewInviteRow, invites } from '../schema/invite.schema';

@Injectable()
export class InvitesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  findAll(statuses?: InviteStatus[]): Invite[] {
    if (statuses?.length) {
      return this.db
        .select()
        .from(invites)
        .where(inArray(invites.status, statuses))
        .all();
    }
    return this.db.select().from(invites).all();
  }

  findByEmail(email: string): Invite | null {
    return (
      this.db.select().from(invites).where(eq(invites.email, email)).get() ??
      null
    );
  }

  findByCodeAndStatus(inviteCode: string, status: InviteStatus): Invite | null {
    return (
      this.db
        .select()
        .from(invites)
        .where(
          and(eq(invites.inviteCode, inviteCode), eq(invites.status, status)),
        )
        .get() ?? null
    );
  }

  save(invite: NewInviteRow): Invite {
    return this.db
      .insert(invites)
      .values(invite)
      .onConflictDoUpdate({
        target: invites.id,
        set: { ...invite, updatedAt: new Date() },
      })
      .returning()
      .get();
  }

  update(id: string, partial: Partial<NewInviteRow>): void {
    this.db.update(invites).set(partial).where(eq(invites.id, id)).run();
  }
}
