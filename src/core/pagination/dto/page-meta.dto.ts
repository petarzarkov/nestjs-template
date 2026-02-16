import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface CursorPageMetaParams {
  take: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
}

export class PageMetaDto {
  @ApiProperty()
  readonly take: number;

  @ApiProperty()
  readonly hasNextPage: boolean;

  @ApiProperty()
  readonly hasPreviousPage: boolean;

  @ApiPropertyOptional({
    description: 'Cursor to fetch the next page. Null if no next page.',
    nullable: true,
  })
  readonly nextCursor: string | null;

  @ApiPropertyOptional({
    description: 'Cursor to fetch the previous page. Null if no previous page.',
    nullable: true,
  })
  readonly previousCursor: string | null;

  constructor(params: CursorPageMetaParams) {
    this.take = params.take;
    this.hasNextPage = params.hasNextPage;
    this.hasPreviousPage = params.hasPreviousPage;
    this.nextCursor = params.nextCursor;
    this.previousCursor = params.previousCursor;
  }
}
