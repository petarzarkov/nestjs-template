import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditAction } from '../enum/audit-action.enum';

@Entity('audit_log')
export class AuditLog {
  @ApiProperty({ description: 'Audit log entry ID' })
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_audit_log',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'User ID of the actor (null for system actions)',
  })
  @Column({ type: 'uuid', nullable: true })
  @Index('audit_actor_id_index')
  actorId!: string | null;

  @ApiProperty({ description: 'The action performed', enum: AuditAction })
  @Column({ type: 'enum', enum: AuditAction, enumName: 'audit_action_enum' })
  @Index('audit_action_index')
  action!: AuditAction;

  @ApiProperty({
    description: 'Name of the audited entity (e.g., "User", "Invite")',
  })
  @Column({ type: 'varchar' })
  @Index('audit_entity_name_index')
  entityName!: string;

  @ApiProperty({ description: 'Primary key of the audited entity' })
  @Column({ type: 'varchar' })
  @Index('audit_entity_id_index')
  entityId!: string;

  @ApiPropertyOptional({
    description: 'Previous values of changed fields (UPDATE/DELETE only)',
  })
  @Column({ type: 'jsonb', nullable: true })
  oldValue!: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'New values of changed fields (INSERT/UPDATE only)',
  })
  @Column({ type: 'jsonb', nullable: true })
  newValue!: Record<string, unknown> | null;

  @ApiProperty({ description: 'Timestamp of the audit event' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
