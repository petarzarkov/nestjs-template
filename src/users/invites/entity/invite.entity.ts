import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Auditable } from '@/core/decorators/auditable.decorator';
import { UserRole } from '@/users/enum/user-role.enum';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';

@Auditable()
@Entity()
export class Invite {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({ unique: true })
  email!: string;

  @Index({ unique: true })
  @Column()
  inviteCode!: string;

  @ApiProperty({ enum: Object.values(UserRole), example: UserRole.USER })
  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role!: UserRole;

  @ApiProperty({
    enum: Object.values(InviteStatus),
    default: InviteStatus.PENDING,
  })
  @Column({
    type: 'enum',
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
