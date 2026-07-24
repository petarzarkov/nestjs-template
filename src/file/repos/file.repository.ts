import { Inject, Injectable } from '@nestjs/common';
import { and, eq, like, type SQL } from 'drizzle-orm';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { BaseRepository } from '@/infra/db/base.repository';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';
import { ListFilesQueryDto } from '../dto/list-files-query.dto';
import { FileEntity } from '../entity/file.entity';
import { files } from '../schema/file.schema';

export interface FindAllPaginatedOptions {
  userId?: string;
}

export interface FindExistingFileParams {
  extension: string;
  name: string;
  userId: string;
  size: number;
}

@Injectable()
export class FilesRepository extends BaseRepository<typeof files> {
  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDB,
    paginationFactory: PaginationFactory,
  ) {
    super(db, files, paginationFactory);
  }

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

    return this.paginate(query, filters.length ? and(...filters) : undefined);
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
}
