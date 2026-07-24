import { createSelectSchema } from 'drizzle-zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { withDateFormat } from '@/core/zod/entity-schema';
import { UserRole } from '@/users/enum/user-role.enum';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import { invites } from '../schema/invite.schema';

/** Invite row/response shape, derived from the Drizzle `invite` table. */
export const inviteSelectSchema = withDateFormat(
  createSelectSchema(invites, {
    role: z.enum(UserRole),
    status: z.enum(InviteStatus),
  }),
);

export class Invite extends createZodDto(inviteSelectSchema) {}
