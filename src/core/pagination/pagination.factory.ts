import { PAGINATION } from '@/constants';
import { Injectable } from '@nestjs/common';
import { asc, count, desc, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgColumn, PgSelect, PgTable } from 'drizzle-orm/pg-core';
import { PageMetaDto } from './dto/page-meta.dto';
import { PageOptionsDto } from './dto/page-options.dto';
import { PageDto } from './dto/page.dto';
import { PaginationOrder } from './enum/pagination-order.enum';

type OrderByColumn = PgColumn | SQL | SQL.Aliased;

@Injectable()
export class PaginationFactory {
  #resolveDefaultOrderKey(table: PgTable): PgColumn | null {
    const tableColumns = Object.values(table) as PgColumn[];
    const columnMap = new Map(tableColumns.map((col) => [col.name, col]));

    for (const key of PAGINATION.ORDER_BY_PRECEDENCE) {
      const column = columnMap.get(key);
      if (column) return column;
    }
    return null;
  }

  #withPagination<T extends PgSelect>(
    qb: T,
    orderByColumn: OrderByColumn,
    orderFn: typeof asc | typeof desc,
    page: number,
    pageSize: number
  ) {
    const offset = (page - 1) * pageSize;
    return qb.orderBy(orderFn(orderByColumn)).limit(pageSize).offset(offset);
  }

  async paginate<TTable extends PgTable>(
    db: NodePgDatabase<Record<string, never>>,
    table: TTable,
    pageOptionsDto: PageOptionsDto,
    options?: {
      where?: SQL;
      orderBy?: OrderByColumn;
      select?: Record<string, SQL | PgColumn>;
    }
  ) {
    const { where, orderBy, select } = options || {};

    // Resolve order by column
    const orderColumn = orderBy || this.#resolveDefaultOrderKey(table);
    if (!orderColumn) {
      throw new Error('No order column specified and no default order column found');
    }

    const orderFn = pageOptionsDto.order === PaginationOrder.ASC ? asc : desc;

    // Build base query - TypeScript will infer types from table parameter
    const baseQuery =
      select && Object.keys(select).length > 0
        ? db.select(select).from(table as unknown as PgTable)
        : db.select().from(table as unknown as PgTable);

    // Build count query using dynamic query builder
    const countQuery = db
      .select({ count: count() })
      .from(table as unknown as PgTable)
      .$dynamic();
    const countPromise = where ? countQuery.where(where).execute() : countQuery.execute();

    // Build paginated data query using dynamic query builder
    const dataQuery = baseQuery.$dynamic();
    const paginatedQuery = where
      ? this.#withPagination(
          dataQuery.where(where),
          orderColumn,
          orderFn,
          pageOptionsDto.page,
          pageOptionsDto.take
        )
      : this.#withPagination(
          dataQuery,
          orderColumn,
          orderFn,
          pageOptionsDto.page,
          pageOptionsDto.take
        );

    const dataPromise = paginatedQuery.execute();

    // Execute queries in parallel
    const [countResult, entities] = await Promise.all([countPromise, dataPromise]);

    const itemCount = Number(countResult[0]?.count || 0);
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    return new PageDto(entities, pageMetaDto);
  }
}
