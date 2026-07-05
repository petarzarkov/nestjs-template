import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { InviteStatus } from '../enum/invite-status.enum';

export const listInvitesQuerySchema = z.object({
  // Accepts a single value or repeated query params; normalized to an array.
  statuses: z
    .union([z.enum(InviteStatus), z.array(z.enum(InviteStatus))])
    .transform(value => (Array.isArray(value) ? value : [value]))
    .optional(),
});

export class ListInvitesQueryDto extends createZodDto(listInvitesQuerySchema) {}
