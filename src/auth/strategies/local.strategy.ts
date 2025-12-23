import { LoginRequestDto } from '@/auth/dto/login-request.dto';
import { SanitizedUser } from '@/users/entity/user.entity';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<SanitizedUser> {
    // Run manual validation before strategy logic as the guards are executed before pipes in nest
    const loginReqDto = plainToInstance(LoginRequestDto, {
      email,
      password,
    });
    const errors = await validate(loginReqDto);
    const errorMessages = errors.flatMap(
      ({ constraints }) => constraints && Object.values(constraints),
    );
    if (errorMessages.length > 0) {
      throw new BadRequestException(errorMessages.join(', '));
    }

    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.suspended) {
      throw new UnauthorizedException('User suspended');
    }

    return user;
  }
}
