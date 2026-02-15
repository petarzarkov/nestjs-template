import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Auditable } from '@/core/decorators/auditable.decorator';
import { UserRole } from '@/users/enum/user-role.enum';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';

@Auditable()
@Entity()
@Unique('UQ_invite_email', ['email'])
export class Invite {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_invite',
  })
  id!: string;

  @ApiProperty()
  @Column()
  email!: string;

  @Unique('UQ_invite_invite_code', ['inviteCode'])
  @Column()
  inviteCode!: string;

  @ApiProperty({ enum: Object.values(UserRole), example: UserRole.USER })
  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
  })
  role!: UserRole;

  @ApiProperty({
    enum: Object.values(InviteStatus),
    default: InviteStatus.PENDING,
  })
  @Column({
    type: 'enum',
    enumName: 'invite_status_enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status!: InviteStatus;

  @ApiProperty()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
