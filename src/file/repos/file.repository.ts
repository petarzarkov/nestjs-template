import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { ListFilesQueryDto } from '../dto/list-files-query.dto';
import { FileEntity } from '../entity/file.entity';

export interface FindAllPaginatedOptions {
  userId?: string;
  includeUserAndOrg: boolean;
}

@Injectable()
export class FilesRepository extends Repository<FileEntity> {
  constructor(
    @InjectRepository(FileEntity)
    repository: Repository<FileEntity>,
    private readonly paginationFactory: PaginationFactory<FileEntity>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findAllPaginated(
    query: ListFilesQueryDto,
    options: FindAllPaginatedOptions,
  ): Promise<PageDto<FileEntity>> {
    const qb = this.createQueryBuilder('file');
    if (options.userId) {
      qb.andWhere('file.userId = :userId', { userId: options.userId });
    }

    if (query.search) {
      const conditions = ['file.name ILIKE :search', 'fund.name ILIKE :search'];

      if (options.includeUserAndOrg) {
        conditions.push(
          'user.email ILIKE :search',
          'user.fullName ILIKE :search',
        );
      }

      qb.andWhere(`(${conditions.join(' OR ')})`, {
        search: `%${query.search}%`,
      });
    }

    return this.paginationFactory.paginate(qb, query);
  }
}
