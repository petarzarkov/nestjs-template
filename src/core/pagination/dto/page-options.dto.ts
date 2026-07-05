import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PAGINATION } from '@/constants';
import { PaginationDirection } from '../enum/pagination-direction.enum';
import { PaginationOrder } from '../enum/pagination-order.enum';

export const pageOptionsSchema = z.object({
  order: z.enum(PaginationOrder).default(PAGINATION.DEFAULT_ORDER),
  cursor: z
    .string()
    .max(PAGINATION.MAX_CURSOR)
    .optional()
    .describe('Opaque cursor for keyset pagination. Omit for the first page.'),
  direction: z
    .enum(PaginationDirection)
    .default(PaginationDirection.FORWARD)
    .describe('Pagination direction relative to the cursor.'),
  take: z.coerce
    .number()
    .int()
    .min(PAGINATION.MIN_TAKE)
    .max(PAGINATION.MAX_TAKE)
    .default(PAGINATION.DEFAULT_TAKE),
  search: z.string().min(1).max(PAGINATION.MAX_SEARCH).optional(),
});

export class PageOptionsDto extends createZodDto(pageOptionsSchema) {}
