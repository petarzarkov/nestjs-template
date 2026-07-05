import { ApiProperty } from '@nestjs/swagger';

export class FileEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  extension!: string;

  @ApiProperty()
  mimetype!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty({ nullable: true })
  size!: number | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true })
  width!: number | null;

  @ApiProperty({ nullable: true })
  height!: number | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
