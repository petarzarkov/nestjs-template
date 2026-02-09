import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HelpersService } from '@/core/helpers/services/helpers.service';
import { PageDto } from '@/core/pagination/dto/page.dto';
import {
  FileAdminResponseDto,
  FileResponseDto,
} from '@/file/dto/file-response.dto';
import { ListFilesQueryDto } from '@/file/dto/list-files-query.dto';
import { FileEntity } from '@/file/entity/file.entity';
import { FilesRepository } from '@/file/repos/file.repository';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { S3Service } from './s3.service';

@Injectable()
export class FileService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly s3Service: S3Service,
    private readonly helpersService: HelpersService,
    private readonly logger: ContextLogger,
  ) {}

  async upload(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<FileEntity[]> {
    const upserted: FileEntity[] = [];
    for (const file of files) {
      const s3File = await this.s3Service.upsertFile({
        fileId: randomUUID(),
        userId,
        file,
        context: 'files',
      });

      const existing = await this.filesRepository.findOne({
        where: {
          extension: s3File.extension,
          name: s3File.name,
          userId,
          size: file.size,
        },
      });
      const imageSize = this.helpersService.isSupportedImageType(
        s3File.extension,
      )
        ? this.helpersService.calculateImageSize(
            {
              id: s3File.fileId,
              buffer: file.buffer,
              extension: s3File.extension,
              mimetype: s3File.mimetype,
            },
            this.logger,
          )
        : null;

      if (existing) {
        const updatedFile = await this.filesRepository.save({
          ...existing,
          userId,
          name: s3File.name,
          extension: s3File.extension,
          mimetype: s3File.mimetype,
          path: s3File.path,
          width: imageSize?.width ?? null,
          height: imageSize?.height ?? null,
          size: file.size,
        });
        upserted.push(updatedFile);
      } else {
        const created = this.filesRepository.create({
          id: s3File.fileId,
          userId,
          path: s3File.path,
          name: s3File.name,
          extension: s3File.extension,
          mimetype: s3File.mimetype,
          width: imageSize?.width ?? null,
          height: imageSize?.height ?? null,
          size: file.size,
        });
        upserted.push(await this.filesRepository.save(created));
      }
    }

    return upserted;
  }

  async findById(fileId: string): Promise<FileEntity> {
    const fileEntity = await this.filesRepository.findOne({
      where: { id: fileId },
    });

    if (!fileEntity) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return fileEntity;
  }

  async downloadById(fileId: string): Promise<{
    stream: Readable;
    contentType: string;
    filename: string;
    contentLength?: number;
    createdBy: string;
  }> {
    const fileEntity = await this.findById(fileId);

    const downloadResult = await this.s3Service.downloadFileByPath(
      fileEntity.path,
    );
    const filename = fileEntity.extension
      ? `${fileEntity.name}.${fileEntity.extension}`
      : fileEntity.name;

    return {
      stream: downloadResult.stream,
      contentType: downloadResult.contentType,
      contentLength: downloadResult.contentLength,
      filename,
      createdBy: fileEntity.userId,
    };
  }

  async deleteById(fileId: string, currentUser: SanitizedUser): Promise<void> {
    const fileEntity = await this.findById(fileId);
    if (
      fileEntity.userId !== currentUser.id &&
      !currentUser.roles.includes(UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'You are not authorized to delete this file',
      );
    }

    if (!fileEntity) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    await this.s3Service.deleteFileByPath(fileEntity.path);
    await this.filesRepository.remove(fileEntity);
  }

  async findAllPaginated(
    query: ListFilesQueryDto,
    currentUser: SanitizedUser,
  ): Promise<PageDto<FileResponseDto | FileAdminResponseDto>> {
    const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

    const filesPage = await this.filesRepository.findAllPaginated(query, {
      userId: isAdmin ? undefined : currentUser.id,
      includeUserAndOrg: isAdmin,
    });

    const data = filesPage.data.map(file => this.toResponseDto(file, isAdmin));

    return new PageDto(data, filesPage.meta);
  }

  async findByIdForUser(
    fileId: string,
    currentUser: SanitizedUser,
  ): Promise<FileResponseDto | FileAdminResponseDto> {
    const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

    const qb = this.filesRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.fund', 'fund')
      .leftJoinAndSelect('file.strategy', 'strategy')
      .where('file.id = :fileId', { fileId });

    if (!isAdmin) {
      qb.andWhere('file.userId = :userId', { userId: currentUser.id });
    }

    if (isAdmin) {
      qb.leftJoinAndSelect('file.user', 'user').leftJoinAndSelect(
        'user.organization',
        'organization',
      );
    }

    const file = await qb.getOne();

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return this.toResponseDto(file, isAdmin);
  }

  private toResponseDto(
    file: FileEntity,
    includeAdminFields: boolean,
  ): FileResponseDto | FileAdminResponseDto {
    const baseDto: FileResponseDto = {
      id: file.id,
      name: file.name,
      extension: file.extension,
      size: file.size,
      width: file.width,
      height: file.height,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };

    if (includeAdminFields) {
      const adminDto: FileAdminResponseDto = {
        ...baseDto,
        userId: file.userId,
      };
      return adminDto;
    }

    return baseDto;
  }
}
