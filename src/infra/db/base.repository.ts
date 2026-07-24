import { eq, getTableColumns, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { PageOptionsDto } from '@/core/pagination/dto/page-options.dto';
import type { PageDto } from '@/core/pagination/dto/page.dto';
import type { PaginationFactory } from '@/core/pagination/pagination.factory';
import type { DrizzleDB } from '@/infra/db/client';

/** A drizzle SQLite table exposing a string `id` primary key. */
export type TableWithId = SQLiteTable & { id: SQLiteColumn };

/**
 * Generic synchronous CRUD over a drizzle/`bun:sqlite` table with a string `id`.
 * Domain repositories extend this and add only their bespoke finders — the
 * common `findById`/`create`/`save`/`update`/`deleteById`/`paginate` live here.
 *
 * The `as` casts are localized here on purpose: drizzle's insert/update builders
 * don't infer cleanly through a generic table parameter, so the internals cast
 * while the public surface stays fully typed via `TSelect`/`TInsert`.
 */
export abstract class BaseRepository<
  TTable extends TableWithId,
  TSelect extends { id: string } = TTable['$inferSelect'] & { id: string },
  TInsert = TTable['$inferInsert'],
> {
  protected constructor(
    protected readonly db: DrizzleDB,
    protected readonly table: TTable,
    protected readonly paginationFactory: PaginationFactory,
  ) {}

  findById(id: string): TSelect | null {
    return (
      (this.db
        .select()
        .from(this.table)
        .where(eq(this.table.id, id))
        .get() as unknown as TSelect | undefined) ?? null
    );
  }

  create(values: TInsert): TSelect {
    return this.db
      .insert(this.table)
      .values(values as TTable['$inferInsert'])
      .returning()
      .get() as unknown as TSelect;
  }

  /** Upsert on the primary key; bumps `updatedAt` when the table has one. */
  save(values: TInsert): TSelect {
    const set: Record<string, unknown> = { ...(values as object) };
    if ('updatedAt' in getTableColumns(this.table)) {
      set.updatedAt = new Date();
    }
    return this.db
      .insert(this.table)
      .values(values as TTable['$inferInsert'])
      .onConflictDoUpdate({
        target: this.table.id,
        set: set as TTable['$inferInsert'],
      })
      .returning()
      .get() as unknown as TSelect;
  }

  update(id: string, values: Partial<TInsert>): void {
    this.db
      .update(this.table)
      .set(values as Partial<TTable['$inferInsert']>)
      .where(eq(this.table.id, id))
      .run();
  }

  deleteById(id: string): void {
    this.db.delete(this.table).where(eq(this.table.id, id)).run();
  }

  /** Cursor pagination via the shared factory (sort key auto-detected). */
  protected paginate(
    pageOptions: PageOptionsDto,
    where?: SQL,
    orderBy?: string,
  ): PageDto<TSelect> {
    return this.paginationFactory.paginate<TSelect>({
      db: this.db,
      table: this.table,
      pageOptions,
      where,
      orderBy,
    });
  }
}
