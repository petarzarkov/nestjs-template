import { Module } from '@nestjs/common';
import { InvitesRepository } from '@/users/invites/repos/invites.repository';
import { InvitesService } from '@/users/invites/services/invites.service';
import { UsersRepository } from '../repos/users.repository';
import { InvitesController } from './invites.controller';

@Module({
  controllers: [InvitesController],
  providers: [InvitesService, InvitesRepository, UsersRepository],
  exports: [InvitesService, InvitesRepository],
})
export class InvitesModule {}
