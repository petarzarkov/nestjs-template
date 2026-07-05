import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  lt,
  or,
  type SQL,
} from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { PAGINATION } from '@/constants';
import type { DrizzleDB } from '@/infra/db/client';
import { type CursorPayload, decodeCursor, encodeCursor } from './cursor.util';
import { PageDto } from './dto/page.dto';
import { PageMetaDto } from './dto/page-meta.dto';
import { PageOptionsDto } from './dto/page-options.dto';
import { PaginationDirection } from './enum/pagination-direction.enum';
import { PaginationOrder } from './enum/pagination-order.enum';

export interface PaginateParams {
  /** The synchronous drizzle client. */
  db: DrizzleDB;
  /** The drizzle table to paginate. */
  table: SQLiteTable;
  pageOptions: PageOptionsDto;
  /** Optional base filter (e.g. search / status conditions). */
  where?: SQL;
  /** Override the sort key; defaults to updatedAt → createdAt → id. */
  orderBy?: string;
}

/**
 * Cursor (keyset) pagination over a synchronous drizzle/SQLite query.
 *
 * Timestamps are stored as integer milliseconds (see `columns.ts`), so the
 * cursor comparison is exact — no `date_trunc`/`::timestamptz` gymnastics are
 * needed as they were on Postgres.
 */
@Injectable()
export class PaginationFactory {
  paginate<T extends { id: string }>(params: PaginateParams): PageDto<T> {
    const { db, table, pageOptions, where } = params;
    const columns = getTableColumns(table) as Record<string, SQLiteColumn>;
    const idColumn = columns.id;

    const orderKey =
      (params.orderBy && columns[params.orderBy]
        ? params.orderBy
        : undefined) ??
      PAGINATION.ORDER_BY_PRECEDENCE.find(key => columns[key]) ??
      'id';
    const sortColumn = columns[orderKey];

    const isBackward = pageOptions.direction === PaginationDirection.BACKWARD;
    const requestedOrder = pageOptions.order ?? PaginationOrder.DESC;
    const effectiveOrder = isBackward
      ? requestedOrder === PaginationOrder.DESC
        ? PaginationOrder.ASC
        : PaginationOrder.DESC
      : requestedOrder;
    const isDesc = effectiveOrder === PaginationOrder.DESC;

    const conditions: SQL[] = [];
    if (where) {
      conditions.push(where);
    }
    if (pageOptions.cursor) {
      const decoded = decodeCursor(pageOptions.cursor);
      conditions.push(
        this.#cursorCondition(orderKey, sortColumn, idColumn, decoded, isDesc),
      );
    }

    const direction = isDesc ? desc : asc;
    const orderClause =
      orderKey === 'id'
        ? [direction(idColumn)]
        : [direction(sortColumn), direction(idColumn)];

    const rows = db
      .select()
      .from(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(...orderClause)
      .limit(pageOptions.take + 1)
      .all() as T[];

    const hasMore = rows.length > pageOptions.take;
    if (hasMore) {
      rows.pop();
    }
    if (isBackward) {
      rows.reverse();
    }

    const hasCursor = !!pageOptions.cursor;
    const hasNextPage = isBackward ? hasCursor : hasMore;
    const hasPreviousPage = isBackward ? hasMore : hasCursor;

    const { nextCursor, previousCursor } = this.#buildCursors(
      rows,
      orderKey,
      hasNextPage,
      hasPreviousPage,
    );

    return new PageDto<T>(
      rows,
      new PageMetaDto({
        take: pageOptions.take,
        hasNextPage,
        hasPreviousPage,
        nextCursor,
        previousCursor,
      }),
    );
  }

  #cursorCondition(
    orderKey: string,
    sortColumn: SQLiteColumn,
    idColumn: SQLiteColumn,
    decoded: CursorPayload,
    isDesc: boolean,
  ): SQL {
    const cmp = isDesc ? lt : gt;

    if (orderKey !== 'id') {
      // Sort columns are millisecond timestamps; the cursor `s` is an ISO
      // string — decode to a Date so drizzle encodes it back to epoch ms.
      const sortValue = new Date(decoded.s);
      return or(
        cmp(sortColumn, sortValue),
        and(eq(sortColumn, sortValue), cmp(idColumn, decoded.i)),
      )!;
    }

    return cmp(idColumn, decoded.i);
  }

  #buildCursors<T extends { id: string }>(
    rows: T[],
    cursorKey: string,
    hasNextPage: boolean,
    hasPreviousPage: boolean,
  ) {
    let nextCursor: string | null = null;
    let previousCursor: string | null = null;

    if (rows.length > 0) {
      const last = rows[rows.length - 1] as T & Record<string, unknown>;
      const first = rows[0] as T & Record<string, unknown>;

      if (hasNextPage) {
        nextCursor = encodeCursor(last[cursorKey] as Date | string, last.id);
      }
      if (hasPreviousPage) {
        previousCursor = encodeCursor(
          first[cursorKey] as Date | string,
          first.id,
        );
      }
    }

    return { nextCursor, previousCursor };
  }
}
