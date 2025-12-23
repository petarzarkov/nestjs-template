import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginationFactory } from '@/core/pagination/pagination.factory';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { GetUsersQueryDto } from '@/users/dto/user.dto';
import { SanitizedUser, User } from '@/users/entity/user.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOneOptions, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    protected readonly logger: ContextLogger,
    private readonly paginationFactory: PaginationFactory<User>,
  ) {}

  async getUsersPaginated(
    getUsersQueryDto: GetUsersQueryDto,
  ): Promise<PageDto<SanitizedUser>> {
    const { search, suspended } = getUsersQueryDto;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');
    if (suspended != undefined) {
      queryBuilder.andWhere({
        suspended,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.username ILIKE :search OR user.email ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    const page = await this.paginationFactory.paginate(
      queryBuilder,
      getUsersQueryDto,
    );
    return page;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findUserWithCredentials(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findOne(options: FindOneOptions<User>): Promise<User | null> {
    return this.usersRepository.findOne(options);
  }

  async update(
    userId: string,
    partialEntity: QueryDeepPartialEntity<User>,
  ): Promise<void> {
    await this.usersRepository.update(userId, partialEntity);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  create(user: DeepPartial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  findByRole(role: string): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where(':role = ANY(user.roles)', { role })
      .getMany();
  }
}
