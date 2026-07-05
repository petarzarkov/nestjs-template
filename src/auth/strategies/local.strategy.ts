import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { loginRequestSchema } from '@/auth/dto/login-request.dto';
import { SanitizedUser } from '@/users/entity/user.entity';
import { AuthService } from '../services/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<SanitizedUser> {
    // Guards run before pipes in Nest, so validate the credentials manually.
    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map(issue => issue.message).join(', '),
      );
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
