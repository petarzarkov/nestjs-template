import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/users/enum/user-role.enum';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';

export class Invite {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

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
