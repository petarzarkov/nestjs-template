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
import { ContextLogger } from '@arkv/nestjs-context-logger';
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
        fileId: crypto.randomUUID(),
        userId,
        file,
        context: 'files',
      });

      const existing = this.filesRepository.findExisting({
        extension: s3File.extension,
        name: s3File.name,
        userId,
        size: file.size,
      });
      const imageSize = this.helpersService.isSupportedImageType(
        s3File.extension,
      )
        ? await this.helpersService.calculateImageSize(
            {
              id: s3File.fileId,
              buffer: file.buffer,
              extension: s3File.extension,
              mimetype: s3File.mimetype,
            },
            this.logger,
          )
        : null;

      const values = {
        userId,
        name: s3File.name,
        extension: s3File.extension,
        mimetype: s3File.mimetype,
        path: s3File.path,
        width: imageSize?.width ?? null,
        height: imageSize?.height ?? null,
        size: file.size,
      };

      if (existing) {
        upserted.push(
          this.filesRepository.save({ id: existing.id, ...values }),
        );
      } else {
        upserted.push(
          this.filesRepository.create({ id: s3File.fileId, ...values }),
        );
      }
    }

    return upserted;
  }

  findById(fileId: string): FileEntity {
    const fileEntity = this.filesRepository.findById(fileId);

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
    const fileEntity = this.findById(fileId);

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
    const fileEntity = this.findById(fileId);
    if (
      fileEntity.userId !== currentUser.id &&
      !currentUser.roles.includes(UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'You are not authorized to delete this file',
      );
    }

    await this.s3Service.deleteFileByPath(fileEntity.path);
    this.filesRepository.deleteById(fileEntity.id);
  }

  findAllPaginated(
    query: ListFilesQueryDto,
    currentUser: SanitizedUser,
  ): PageDto<FileResponseDto | FileAdminResponseDto> {
    const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

    const filesPage = this.filesRepository.findAllPaginated(query, {
      userId: isAdmin ? undefined : currentUser.id,
      includeUserAndOrg: isAdmin,
    });

    const data = filesPage.data.map(file => this.toResponseDto(file, isAdmin));

    return new PageDto(data, filesPage.meta);
  }

  findByIdForUser(
    fileId: string,
    currentUser: SanitizedUser,
  ): FileResponseDto | FileAdminResponseDto {
    const isAdmin = currentUser.roles.includes(UserRole.ADMIN);

    const file = this.filesRepository.findByIdForUser(
      fileId,
      isAdmin ? undefined : currentUser.id,
    );

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return this.toResponseDto(file, isAdmin);
  }

  private toResponseDto(
    file: FileEntity,
    includeAdminFields: boolean,
  ): FileResponseDto | FileAdminResponseDto {
    const baseDto = {
      id: file.id,
      name: file.name,
      extension: file.extension,
      size: file.size ?? undefined,
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
