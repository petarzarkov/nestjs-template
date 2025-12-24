import type { Invite } from '@/users/invites/entity/invite.entity';

export interface RegisteredPayload {
  email: string;
  name: string;
  type: 'direct' | 'invite';
}

export interface PasswordResetPayload {
  userId: string;
  email: string;
  name: string;
  resetToken: string;
}

export interface InvitePayload {
  invite: Invite;
}
