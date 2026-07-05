import { Inject, Injectable } from '@nestjs/common';
import { and, eq, like, type SQL } from 'drizzle-orm';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { ListFilesQueryDto } from '../dto/list-files-query.dto';
import { FileEntity } from '../entity/file.entity';
import { type NewFileRow, files } from '../schema/file.schema';

export interface FindAllPaginatedOptions {
  userId?: string;
  includeUserAndOrg: boolean;
}

export interface FindExistingFileParams {
  extension: string;
  name: string;
  userId: string;
  size: number;
}

@Injectable()
export class FilesRepository {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly paginationFactory: PaginationFactory,
  ) {}

  findAllPaginated(
    query: ListFilesQueryDto,
    options: FindAllPaginatedOptions,
  ): PageDto<FileEntity> {
    const filters: SQL[] = [];
    if (options.userId) {
      filters.push(eq(files.userId, options.userId));
    }
    if (query.search) {
      filters.push(like(files.name, `%${query.search}%`));
    }

    return this.paginationFactory.paginate<FileEntity>({
      db: this.db,
      table: files,
      pageOptions: query,
      where: filters.length ? and(...filters) : undefined,
    });
  }

  findExisting(params: FindExistingFileParams): FileEntity | null {
    return (
      this.db
        .select()
        .from(files)
        .where(
          and(
            eq(files.extension, params.extension),
            eq(files.name, params.name),
            eq(files.userId, params.userId),
            eq(files.size, params.size),
          ),
        )
        .get() ?? null
    );
  }

  findById(id: string): FileEntity | null {
    return this.db.select().from(files).where(eq(files.id, id)).get() ?? null;
  }

  findByIdForUser(fileId: string, userId?: string): FileEntity | null {
    const conditions: SQL[] = [eq(files.id, fileId)];
    if (userId) {
      conditions.push(eq(files.userId, userId));
    }
    return (
      this.db
        .select()
        .from(files)
        .where(and(...conditions))
        .get() ?? null
    );
  }

  create(file: NewFileRow): FileEntity {
    return this.db.insert(files).values(file).returning().get();
  }

  save(file: NewFileRow): FileEntity {
    return this.db
      .insert(files)
      .values(file)
      .onConflictDoUpdate({
        target: files.id,
        set: { ...file, updatedAt: new Date() },
      })
      .returning()
      .get();
  }

  deleteById(id: string): void {
    this.db.delete(files).where(eq(files.id, id)).run();
  }
}
