import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PAGINATION } from '@/constants';
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
    minimum: PAGINATION.MIN_PAGE,
    default: PAGINATION.DEFAULT_PAGE,
  })
  @IsInt()
  @Min(PAGINATION.MIN_PAGE)
  @IsOptional()
  readonly page: number = PAGINATION.DEFAULT_PAGE;

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
  @MaxLength(PAGINATION.MAX_SEARCH)
  readonly search?: string;
}
