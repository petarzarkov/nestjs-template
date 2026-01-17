import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infra/db/database.module';
import { InvitesRepository } from '@/users/invites/repos/invites.repository';
import { InvitesService } from '@/users/invites/services/invites.service';
import { User } from '../entity/user.entity';
import { UsersRepository } from '../repos/users.repository';
import { Invite } from './entity/invite.entity';
import { InvitesController } from './invites.controller';

@Module({
  imports: [DatabaseModule.forFeature([Invite, User])],
  controllers: [InvitesController],
  providers: [InvitesService, InvitesRepository, UsersRepository],
  exports: [InvitesService, InvitesRepository],
})
export class InvitesModule {}
