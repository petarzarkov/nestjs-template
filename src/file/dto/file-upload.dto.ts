import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize } from 'class-validator';
import { FILES } from '@/constants';

export class FileUploadDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'File to be uploaded',
    required: true,
  })
  @ArrayMaxSize(FILES.MAX_FILES)
  files!: Express.Multer.File[];
}
