import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PAGINATION } from '@/constants';
import { type CursorPayload, decodeCursor, encodeCursor } from './cursor.util';
import { PageDto } from './dto/page.dto';
import { PageMetaDto } from './dto/page-meta.dto';
import { PageOptionsDto } from './dto/page-options.dto';
import { PaginationDirection } from './enum/pagination-direction.enum';
import { PaginationOrder } from './enum/pagination-order.enum';

@Injectable()
export class PaginationFactory<
  Entity extends ObjectLiteral,
  OrderKey extends Extract<keyof Entity, string> = Extract<
    keyof Entity,
    string
  >,
> {
  #resolveDefaultOrderKey<E extends ObjectLiteral>(qb: SelectQueryBuilder<E>) {
    const cols = qb.expressionMap.mainAlias?.metadata?.columns ?? [];
    const names = new Set(cols.map(c => c.propertyName));
    for (const key of PAGINATION.ORDER_BY_PRECEDENCE) {
      if (names.has(key)) return key;
    }
    return null;
  }

  #applyCursorWhere(
    queryBuilder: SelectQueryBuilder<Entity>,
    alias: string,
    orderKey: string | null,
    decoded: CursorPayload,
    effectiveOrder: PaginationOrder,
  ) {
    const cmp = effectiveOrder === PaginationOrder.DESC ? '<' : '>';

    if (orderKey && orderKey !== 'id') {
      // Use date_trunc to match JavaScript Date millisecond precision,
      // since PostgreSQL timestamps have microsecond precision.
      const sortExpr = `date_trunc('milliseconds', ${alias}.${orderKey})`;
      queryBuilder.andWhere(
        `(${sortExpr} ${cmp} :cursorSortVal::timestamptz ` +
          `OR (${sortExpr} = :cursorSortVal::timestamptz ` +
          `AND ${alias}.id ${cmp} :cursorId))`,
        { cursorSortVal: decoded.s, cursorId: decoded.i },
      );
    } else {
      queryBuilder.andWhere(`${alias}.id ${cmp} :cursorId`, {
        cursorId: decoded.i,
      });
    }
  }

  #buildCursors(
    entities: Entity[],
    cursorKey: string,
    hasNextPage: boolean,
    hasPreviousPage: boolean,
  ) {
    let nextCursor: string | null = null;
    let previousCursor: string | null = null;

    if (entities.length > 0) {
      const last = entities[entities.length - 1];
      const first = entities[0];

      if (hasNextPage) {
        nextCursor = encodeCursor(last[cursorKey], last.id);
      }
      if (hasPreviousPage) {
        previousCursor = encodeCursor(first[cursorKey], first.id);
      }
    }

    return { nextCursor, previousCursor };
  }

  async paginate(
    queryBuilder: SelectQueryBuilder<Entity>,
    pageOptionsDto: PageOptionsDto,
    orderBy?: OrderKey,
    computedColumns?: string[],
  ): Promise<PageDto<Entity>> {
    const alias = queryBuilder.alias;
    const orderKeyToUse =
      (typeof orderBy === 'string' && orderBy) ||
      this.#resolveDefaultOrderKey(queryBuilder);

    const isBackward =
      pageOptionsDto.direction === PaginationDirection.BACKWARD;
    const requestedOrder = pageOptionsDto.order ?? PaginationOrder.DESC;
    const effectiveOrder = isBackward
      ? requestedOrder === PaginationOrder.DESC
        ? PaginationOrder.ASC
        : PaginationOrder.DESC
      : requestedOrder;

    if (pageOptionsDto.cursor) {
      const decoded = decodeCursor(pageOptionsDto.cursor);
      this.#applyCursorWhere(
        queryBuilder,
        alias,
        orderKeyToUse,
        decoded,
        effectiveOrder,
      );
    }

    if (orderKeyToUse) {
      if (orderKeyToUse !== 'id') {
        // Use date_trunc to match cursor WHERE precision (milliseconds)
        queryBuilder.orderBy(
          `date_trunc('milliseconds', ${alias}.${orderKeyToUse})`,
          effectiveOrder,
        );
        queryBuilder.addOrderBy(`${alias}.id`, effectiveOrder);
      } else {
        queryBuilder.orderBy(`${alias}.id`, effectiveOrder);
      }
    }

    queryBuilder.take(pageOptionsDto.take + 1);

    const entities: Entity[] =
      computedColumns && computedColumns.length > 0
        ? await this.#fetchWithComputedColumns(queryBuilder, computedColumns)
        : await queryBuilder.getMany();

    const hasMore = entities.length > pageOptionsDto.take;
    if (hasMore) {
      entities.pop();
    }

    if (isBackward) {
      entities.reverse();
    }

    const hasCursor = !!pageOptionsDto.cursor;
    const hasNextPage = isBackward ? hasCursor : hasMore;
    const hasPreviousPage = isBackward ? hasMore : hasCursor;
    const cursorKey = orderKeyToUse ?? 'id';

    const { nextCursor, previousCursor } = this.#buildCursors(
      entities,
      cursorKey,
      hasNextPage,
      hasPreviousPage,
    );

    const meta = new PageMetaDto({
      take: pageOptionsDto.take,
      hasNextPage,
      hasPreviousPage,
      nextCursor,
      previousCursor,
    });

    return new PageDto(entities, meta);
  }

  async #fetchWithComputedColumns(
    queryBuilder: SelectQueryBuilder<Entity>,
    computedColumns: string[],
  ): Promise<Entity[]> {
    const { entities, raw } = await queryBuilder.getRawAndEntities();
    const alias = queryBuilder.alias;
    const idColumn = `${alias}_id`;

    const rawDataMap = new Map<string, ObjectLiteral>();
    for (const rawRow of raw) {
      const entityId = rawRow[idColumn];
      if (entityId !== undefined && !rawDataMap.has(entityId)) {
        rawDataMap.set(entityId, rawRow);
      }
    }

    return entities.map(entity => {
      const rawRow = rawDataMap.get(entity.id);
      if (!rawRow) return entity;

      const computedValues = computedColumns.reduce(
        (acc, columnName) => {
          const rawKeyWithoutPrefix = columnName;
          const rawKeyWithPrefix = `${alias}_${columnName}`;

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
    }) as Entity[];
  }
}
