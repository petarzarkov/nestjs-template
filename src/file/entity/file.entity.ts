import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { withDateFormat } from '@/core/zod/entity-schema';
import { files } from '../schema/file.schema';

/** File row/response shape, derived from the Drizzle `files` table. */
export const fileSelectSchema = withDateFormat(createSelectSchema(files));

export class FileEntity extends createZodDto(fileSelectSchema) {}
