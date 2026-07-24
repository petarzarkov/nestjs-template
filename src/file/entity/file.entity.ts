import { ApiProperty } from '@nestjs/swagger';
import type { Equal, Expect } from '@/core/utils/type-equal';
import type { FileRow } from '../schema/file.schema';

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

/** Compile-time drift guard: must match the Drizzle `files` row. */
export type _FileMatchesRow = Expect<Equal<FileEntity, FileRow>>;
