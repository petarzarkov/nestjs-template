import * as crypto from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { EVENT_CONSTANTS } from '@/notifications/events/events';
import { StreamPublisherService } from '@/redis/streams/stream-publisher.service';
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
    private readonly eventPublisher: StreamPublisherService,
  ) {}

  async findAll(query: ListInvitesQueryDto): Promise<Invite[]> {
    if (query.statuses?.length) {
      return this.invitesRepository.find({
        where: {
          status: In(query.statuses),
        },
      });
    }

    return this.invitesRepository.find({});
  }

  async create(createInviteDto: CreateInviteDto): Promise<Invite> {
    const { email, role } = createInviteDto;

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        `User with email ${email} already registered.`,
      );
    }

    // Check for any existing invite with this email
    const existingInvite = await this.invitesRepository.findOne({
      where: { email },
    });

    if (existingInvite) {
      // Update the existing invite with new data
      existingInvite.role = role;
      existingInvite.status = InviteStatus.PENDING;
      existingInvite.inviteCode = crypto.randomBytes(32).toString('hex');
      existingInvite.expiresAt = new Date();
      existingInvite.expiresAt.setDate(existingInvite.expiresAt.getDate() + 7);

      const updatedInvite = await this.invitesRepository.save(existingInvite);

      // Publish invite event
      await this.eventPublisher.publishEvent(
        EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED,
        { invite: updatedInvite },
        { emitToAdmins: true },
      );

      return updatedInvite;
    }

    // Create new invite if none exists
    const inviteCode = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inviteToCreate = this.invitesRepository.create({
      email,
      inviteCode,
      role,
      expiresAt,
      status: InviteStatus.PENDING,
    });

    const savedInvite = await this.invitesRepository.save(inviteToCreate);

    // Publish invite event
    await this.eventPublisher.publishEvent(
      EVENT_CONSTANTS.ROUTING_KEYS.USER_INVITED,
      { invite: savedInvite },
      { emitToAdmins: true },
    );

    return savedInvite;
  }
}
