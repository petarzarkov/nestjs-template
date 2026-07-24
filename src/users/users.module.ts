import { forwardRef, Module } from '@nestjs/common';
import { InvitesModule } from './invites/invites.module';
import { UsersRepository } from './repos/users.repository';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [forwardRef(() => InvitesModule)],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
