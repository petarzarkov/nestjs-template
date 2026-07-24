import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { BaseRepository } from '@/infra/db/base.repository';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { Invite } from '../entity/invite.entity';
import { InviteStatus } from '../enum/invite-status.enum';
import { invites } from '../schema/invite.schema';

@Injectable()
export class InvitesRepository extends BaseRepository<typeof invites> {
  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDB,
    paginationFactory: PaginationFactory,
  ) {
    super(db, invites, paginationFactory);
  }

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
}
