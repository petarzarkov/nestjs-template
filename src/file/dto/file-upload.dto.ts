import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger-only description of the multipart upload body. The actual files are
 * parsed by FilesInterceptor + the ParseFilePipe validators (see
 * `@ValidatedFiles`), not by the Zod pipe — binary uploads aren't a Zod concern.
 */
export class FileUploadDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Files to be uploaded',
    required: true,
  })
  files!: Express.Multer.File[];
}
