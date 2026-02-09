import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  extension!: string;

  @ApiPropertyOptional()
  size?: number;

  @ApiProperty({ nullable: true })
  width!: number | null;

  @ApiProperty({ nullable: true })
  height!: number | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class FileAdminResponseDto extends FileResponseDto {
  @ApiProperty({ description: 'User ID (ADMIN only)' })
  userId!: string;

  @ApiPropertyOptional({ description: 'User full name (ADMIN only)' })
  userFullName?: string;
}
