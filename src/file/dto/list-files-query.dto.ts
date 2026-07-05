import { createZodDto } from 'nestjs-zod';
import { pageOptionsSchema } from '@/core/pagination/dto/page-options.dto';

export class ListFilesQueryDto extends createZodDto(pageOptionsSchema) {}
