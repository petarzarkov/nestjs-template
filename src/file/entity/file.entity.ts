import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@/users/entity/user.entity';

@Entity('files')
@Unique('UQ_file_path', ['path'])
export class FileEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_file',
  })
  id!: string;

  @ApiProperty()
  @Column()
  name!: string;

  @ApiProperty()
  @Column()
  extension!: string;

  @ApiProperty()
  @Column()
  mimetype!: string;

  @ApiProperty()
  @Column()
  path!: string;

  @ApiProperty()
  @Column({
    type: 'int',
    nullable: true,
    default: null,
  })
  size?: number;

  @ApiProperty()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_file_to_user' })
  user!: User;

  @ApiProperty()
  @Column({ name: 'width', nullable: true, type: 'integer', default: null })
  width!: number | null;

  @ApiProperty()
  @Column({ name: 'height', nullable: true, type: 'integer', default: null })
  height!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
