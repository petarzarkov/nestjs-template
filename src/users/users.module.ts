import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '@/db/database.module';
import { PasswordResetToken } from '@/users/entity/password-reset-token.entity';
import { User } from '@/users/entity/user.entity';
import { InvitesModule } from './invites/invites.module';
import { PasswordResetTokensRepository } from './repos/password-reset-tokens.repository';
import { UsersRepository } from './repos/users.repository';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    DatabaseModule.forFeature([User, PasswordResetToken]),
    forwardRef(() => InvitesModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, PasswordResetTokensRepository],
  exports: [UsersService, UsersRepository, PasswordResetTokensRepository],
})
export class UsersModule {}
