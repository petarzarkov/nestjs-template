import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PAGINATION } from '@/constants';
import { PaginationDirection } from '../enum/pagination-direction.enum';
import { PaginationOrder } from '../enum/pagination-order.enum';

export class PageOptionsDto {
  @ApiPropertyOptional({
    enum: PaginationOrder,
    default: PAGINATION.DEFAULT_ORDER,
  })
  @IsEnum(PaginationOrder)
  @IsOptional()
  readonly order?: PaginationOrder = PAGINATION.DEFAULT_ORDER;

  @ApiPropertyOptional({
    description:
      'Opaque cursor for keyset pagination. Omit for the first page.',
    maxLength: PAGINATION.MAX_CURSOR,
  })
  @IsString()
  @IsOptional()
  @MaxLength(PAGINATION.MAX_CURSOR)
  readonly cursor?: string;

  @ApiPropertyOptional({
    enum: PaginationDirection,
    default: PaginationDirection.FORWARD,
    description: 'Pagination direction relative to the cursor.',
  })
  @IsEnum(PaginationDirection)
  @IsOptional()
  readonly direction?: PaginationDirection = PaginationDirection.FORWARD;

  @ApiPropertyOptional({
    minimum: PAGINATION.MIN_TAKE,
    default: PAGINATION.DEFAULT_TAKE,
  })
  @IsInt()
  @Min(PAGINATION.MIN_TAKE)
  @Max(PAGINATION.MAX_TAKE)
  @IsOptional()
  readonly take: number = PAGINATION.DEFAULT_TAKE;

  @ApiPropertyOptional({
    maxLength: PAGINATION.MAX_SEARCH,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(PAGINATION.MAX_SEARCH)
  readonly search?: string;
}
