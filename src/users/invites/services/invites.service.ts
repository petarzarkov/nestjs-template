import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { JobPublisherService } from '@/infra/queue/services/job-publisher.service';
import { EVENTS } from '@/notifications/events/events';
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
}
