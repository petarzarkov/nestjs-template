import { ApiProperty } from '@nestjs/swagger';
import type { Equal, Expect } from '@/core/utils/type-equal';
import { UserRole } from '@/users/enum/user-role.enum';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import type { InviteRow } from '../schema/invite.schema';

export class Invite {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  inviteCode!: string;

  @ApiProperty({ enum: Object.values(UserRole), example: UserRole.USER })
  role!: UserRole;

  @ApiProperty({ enum: Object.values(InviteStatus) })
  status!: InviteStatus;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/** Compile-time drift guard: must match the Drizzle `invite` row. */
export type _InviteMatchesRow = Expect<Equal<Invite, InviteRow>>;
