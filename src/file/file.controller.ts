import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AppEnv } from '@/config/enum/app-env.enum';
import { MINUTE } from '@/constants';
import { ApiJwtAuth } from '@/core/decorators/api-jwt-auth.decorator';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { EnvThrottle } from '@/core/decorators/env-throttle.decorator';
import { Roles } from '@/core/decorators/roles.decorator';
import {
  ApiUuidParam,
  UuidParam,
} from '@/core/decorators/uuid-param.decorator';
import { ValidatedFiles } from '@/core/decorators/validated-files.decorator';
import { PageDto } from '@/core/pagination/dto/page.dto';
import { PaginatedDto } from '@/core/pagination/dto/paginated.dto';
import {
  FileAdminResponseDto,
  FileResponseDto,
} from '@/file/dto/file-response.dto';
import { FileUploadDto } from '@/file/dto/file-upload.dto';
import { ListFilesQueryDto } from '@/file/dto/list-files-query.dto';
import { FileEntity } from '@/file/entity/file.entity';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { EnvThrottlerGuard } from '@/infra/redis/guards/env-throttler.guard';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { MultipartFormDataGuard } from './guards/multipart-form-data.guard';
import { FileService } from './services/file.service';

@ApiTags('files')
@ApiJwtAuth()
@Controller('files')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly logger: ContextLogger,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List paginated files. ADMIN sees all files, others see only their own.',
  })
  @ApiOkResponse({
    description: 'A paginated list of files.',
    type: PaginatedDto(FileAdminResponseDto),
  })
  @Roles(UserRole.ADMIN)
  list(
    @CurrentUser() currentUser: SanitizedUser,
    @Query() query: ListFilesQueryDto,
  ): Promise<PageDto<FileResponseDto | FileAdminResponseDto>> {
    return this.fileService.findAllPaginated(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a file by ID. ADMIN can fetch any file, others only their own.',
  })
  @Roles(UserRole.ADMIN)
  @ApiUuidParam({ name: 'id', description: 'File identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File details',
    type: FileAdminResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to view this file',
  })
  getById(
    @UuidParam({ name: 'id' }) fileId: string,
    @CurrentUser() currentUser: SanitizedUser,
  ): Promise<FileResponseDto | FileAdminResponseDto> {
    return this.fileService.findByIdForUser(fileId, currentUser);
  }

  @Post()
  @UseGuards(MultipartFormDataGuard, EnvThrottlerGuard)
  @EnvThrottle({
    [AppEnv.LOCAL]: 1 * MINUTE,
    [AppEnv.DEV]: 10 * MINUTE,
    [AppEnv.STG]: 20 * MINUTE,
    [AppEnv.PRD]: 20 * MINUTE,
    limit: 1,
  })
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload and store a batch of files (image, pdf document, csv)',
  })
  @ApiBody({
    description: 'List of files to upload',
    type: FileUploadDto,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Files successfully uploaded',
    type: FileEntity,
    isArray: true,
  })
  @Roles(UserRole.ADMIN)
  uploadFiles(
    @CurrentUser() user: SanitizedUser,
    @ValidatedFiles({
      fileType: /^image\/(jpg|jpeg|png|gif)$|^text\/csv$|^application\/pdf$/,
    })
    files: Express.Multer.File[],
  ): Promise<FileEntity[]> {
    return this.fileService.upload(user.id, files);
  }

  @Get('download/:id')
  @ApiOperation({
    summary: 'Download a file by ID',
  })
  @ApiUuidParam({ name: 'id', description: 'File identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File successfully downloaded',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  @Roles(UserRole.ADMIN)
  async downloadFile(
    @UuidParam({ name: 'id' }) fileId: string,
    @Res() res: Response,
    @CurrentUser() currentUser: SanitizedUser,
  ): Promise<void> {
    const { stream, contentType, filename, contentLength, createdBy } =
      await this.fileService.downloadById(fileId);

    if (
      createdBy !== currentUser.id &&
      !currentUser.roles.includes(UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'You are not authorized to download this file',
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    };

    if (contentLength) {
      headers['Content-Length'] = contentLength.toString();
    }

    res.set(headers);

    // Pipe the stream directly to the response
    stream.pipe(res);

    // Handle stream errors
    stream.on('error', error => {
      this.logger.error('Error streaming file', error);
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send('Error downloading file');
      }
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a file by ID',
  })
  @ApiUuidParam({ name: 'id', description: 'File identifier' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'File successfully deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  @Roles(UserRole.ADMIN)
  async deleteFile(
    @UuidParam({ name: 'id' }) fileId: string,
    @CurrentUser() currentUser: SanitizedUser,
  ): Promise<void> {
    await this.fileService.deleteById(fileId, currentUser);
  }
}
