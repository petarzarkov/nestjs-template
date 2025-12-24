import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PAGINATION } from '@/constants';
import { PageDto } from './dto/page.dto';
import { PageMetaDto } from './dto/page-meta.dto';
import { PageOptionsDto } from './dto/page-options.dto';

@Injectable()
export class PaginationFactory<
  Entity extends ObjectLiteral,
  OrderKey extends Extract<keyof Entity, string> = Extract<
    keyof Entity,
    string
  >,
> {
  #resolveDefaultOrderKey<Entity extends ObjectLiteral>(
    qb: SelectQueryBuilder<Entity>,
  ) {
    const cols = qb.expressionMap.mainAlias?.metadata?.columns ?? [];
    const names = new Set(cols.map(c => c.propertyName));
    for (const key of PAGINATION.ORDER_BY_PRECEDENCE) {
      if (names.has(key)) return key;
    }
    return null;
  }

  async paginate(
    queryBuilder: SelectQueryBuilder<Entity>,
    pageOptionsDto: PageOptionsDto,
    orderBy?: OrderKey,
    computedColumns?: string[],
  ): Promise<PageDto<Entity>> {
    const skip = (pageOptionsDto.page - 1) * pageOptionsDto.take;
    const dataQb = queryBuilder.clone();
    const extendedQuery = queryBuilder.skip(skip).take(pageOptionsDto.take);

    const orderKeyToUse =
      (typeof orderBy === 'string' && orderBy) ||
      this.#resolveDefaultOrderKey(queryBuilder);

    if (orderKeyToUse) {
      extendedQuery.orderBy(
        `${queryBuilder.alias}.${orderKeyToUse}`,
        pageOptionsDto.order,
      );
    }

    if (computedColumns && computedColumns.length > 0) {
      const dataPromise = extendedQuery.getRawAndEntities();
      const countQb = dataQb.clone();
      const countPromise = countQb
        .select(`COUNT(DISTINCT "${queryBuilder.alias}"."id")`, 'count')
        .getRawOne<{ count: string }>();

      const [data, countResult] = await Promise.all([
        dataPromise,
        countPromise,
      ]);

      const itemCount = parseInt(countResult?.count || '0', 10);
      const { entities, raw } = data;

      const rawDataMap = new Map<string, ObjectLiteral>();
      const idColumn = `${queryBuilder.alias}_id`;

      for (const rawRow of raw) {
        const entityId = rawRow[idColumn];
        if (entityId !== undefined && !rawDataMap.has(entityId)) {
          rawDataMap.set(entityId, rawRow);
        }
      }

      const mergedEntities = entities.map(entity => {
        const rawRow = rawDataMap.get(entity.id);

        if (!rawRow) return entity;

        const computedValues = computedColumns.reduce(
          (acc, columnName) => {
            const rawKeyWithoutPrefix = columnName;
            const rawKeyWithPrefix = `${queryBuilder.alias}_${columnName}`;

            if (rawKeyWithoutPrefix in rawRow) {
              acc[columnName] = rawRow[rawKeyWithoutPrefix];
            } else if (rawKeyWithPrefix in rawRow) {
              acc[columnName] = rawRow[rawKeyWithPrefix];
            }
            return acc;
          },
          {} as Record<string, unknown>,
        );

        return { ...entity, ...computedValues };
      });

      const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
      return new PageDto(mergedEntities as Entity[], pageMetaDto);
    }

    const [entities, itemCount] = await extendedQuery.getManyAndCount();
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }
}
