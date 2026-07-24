import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import type { Auth } from '@/auth/auth.config';
import { JobPublisherService } from '@/infra/queue/services/job-publisher.service';
import { EVENTS } from '@/notifications/events/events';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { AcceptInviteDto } from '@/users/invites/dto/accept-invite.dto';
import { CreateInviteDto } from '@/users/invites/dto/create-invite.dto';
import { ListInvitesQueryDto } from '@/users/invites/dto/list-invites.dto';
import { Invite } from '@/users/invites/entity/invite.entity';
import { InviteStatus } from '@/users/invites/enum/invite-status.enum';
import { InvitesRepository } from '@/users/invites/repos/invites.repository';
import { UsersRepository } from '@/users/repos/users.repository';

@Injectable()
export class InvitesService {
  constructor(
    private readonly invitesRepository: InvitesRepository,
    private readonly usersRepository: UsersRepository,
    // Only used by `acceptInvite` (an HTTP flow that runs in the main process).
    // Optional so this module can also load inside the sandboxed job-worker
    // context, whose `JobModule` has no Better Auth `AuthModule`.
    @Optional() private readonly authService: AuthService<Auth> | undefined,
    private readonly jobPublisher: JobPublisherService,
  ) {}

  findAll(query: ListInvitesQueryDto): Invite[] {
    return this.invitesRepository.findAll(query.statuses);
  }

  async create(createInviteDto: CreateInviteDto): Promise<Invite> {
    const { email, role } = createInviteDto;

    const existingUser = this.usersRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException(
        `User with email ${email} already registered.`,
      );
    }

    // Reuse an existing invite row for this email if present (keeps its id).
    const existingInvite = this.invitesRepository.findByEmail(email);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = this.invitesRepository.save({
      id: existingInvite?.id,
      email,
      inviteCode: randomBytes(32).toString('hex'),
      role,
      expiresAt,
      status: InviteStatus.PENDING,
    });

    await this.jobPublisher.publishJob(
      EVENTS.ROUTING_KEYS.USER_INVITED,
      { invite },
      { emitToAdmins: true },
    );

    return invite;
  }

  /**
   * Public invite acceptance: validate the code, create the account through
   * Better Auth (`auth.api.signUpEmail` → scrypt hash + `account` row + the
   * `user.create` hook that fires the welcome notification), apply the invited
   * role, and mark the invite accepted.
   */
  async acceptInvite(dto: AcceptInviteDto): Promise<SanitizedUser> {
    if (!this.authService) {
      throw new ForbiddenException('Auth unavailable in this process');
    }

    const invite = this.invitesRepository.findByCodeAndStatus(
      dto.inviteCode,
      InviteStatus.PENDING,
    );
    if (!invite) {
      throw new ForbiddenException('Invalid invite');
    }
    if (invite.expiresAt < new Date()) {
      this.invitesRepository.update(invite.id, {
        status: InviteStatus.EXPIRED,
      });
      throw new ForbiddenException('Expired invite');
    }

    const { user } = await this.authService.api.signUpEmail({
      body: {
        email: invite.email,
        password: dto.password,
        name: invite.email.split('@')[0],
      },
    });

    if (invite.role !== UserRole.USER) {
      this.usersRepository.update(user.id, { role: invite.role });
    }
    this.invitesRepository.update(invite.id, {
      status: InviteStatus.ACCEPTED,
    });

    const created = this.usersRepository.findById(user.id);
    if (!created) {
      throw new ForbiddenException('Failed to create user from invite');
    }
    return created;
  }
}
