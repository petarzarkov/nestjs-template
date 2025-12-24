import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload } from '@/auth/dto/access-token-payload';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { UsersRepository } from '@/users/repos/users.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: AppConfigService<ValidatedConfig>,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    const user = await this.usersRepository.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.suspended) {
      throw new UnauthorizedException('User suspended');
    }

    return user;
  }
}
