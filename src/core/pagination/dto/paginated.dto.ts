import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from './page-meta.dto';

export function PaginatedDto<T extends Type<unknown>>(resourceDto: T) {
  const className = `Paginated${resourceDto.name}`;

  class GeneratedPaginatedDto {
    @ApiProperty({ isArray: true, type: () => resourceDto })
    readonly data!: InstanceType<T>[];

    @ApiProperty({ type: () => PageMetaDto })
    readonly meta!: PageMetaDto;
  }

  Object.defineProperty(GeneratedPaginatedDto, 'name', { value: className });
  return GeneratedPaginatedDto;
}
