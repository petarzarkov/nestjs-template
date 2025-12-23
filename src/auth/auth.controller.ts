import { AuthResponseDto } from '@/auth/dto/auth-response.dto';
import { BaseResponseDto } from '@/auth/dto/base-response.dto';
import { LoginRequestDto } from '@/auth/dto/login-request.dto';
import {
  PasswordResetDto,
  RequestPasswordResetDto,
} from '@/auth/dto/password-reset.dto';
import { RegisterWithEmailDto } from '@/auth/dto/register-with-email.dto';
import { RegisterWithInviteDto } from '@/auth/dto/register-with-invite.dto';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { UnionValidationPipe } from '@/core/pipes/union-validation.pipe';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UsersService } from '@/users/services/users.service';
import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthService } from './services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Authenticates a user with email and password' })
  @ApiBody({
    type: LoginRequestDto,
  })
  @ApiOkResponse({
    type: AuthResponseDto,
  })
  login(@CurrentUser() user: SanitizedUser): AuthResponseDto {
    const accessToken = this.authService.createAccessToken(
      user.id,
      user.email,
      user.roles,
    );

    return { accessToken };
  }

  @Post('forgotten-password')
  @ApiOkResponse({
    type: BaseResponseDto,
  })
  @ApiOperation({
    summary:
      'Request reset email should be sent if an user is registered with this email.',
  })
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
  ) {
    const { email } = requestPasswordResetDto;

    await this.authService.requestPasswordReset(email);

    return { message: 'Password reset email sent' };
  }

  @Post('password-reset')
  @ApiOkResponse({
    type: BaseResponseDto,
    description: 'Success if the password is changed.',
  })
  passwordReset(@Body() passwordResetDto: PasswordResetDto) {
    const { resetToken, newPassword } = passwordResetDto;

    return this.authService.passwordReset(resetToken, newPassword);
  }

  @Post('register')
  @ApiExtraModels(RegisterWithEmailDto, RegisterWithInviteDto)
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/RegisterWithEmailDto' },
        { $ref: '#/components/schemas/RegisterWithInviteDto' },
      ],
    },
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @UsePipes(
    new UnionValidationPipe({
      discriminator: (body: object) => {
        if ('invitationToken' in body) return RegisterWithInviteDto;
        if ('email' in body) return RegisterWithEmailDto;
        return RegisterWithEmailDto;
      },
      types: [RegisterWithEmailDto, RegisterWithInviteDto],
    }),
  )
  async register(
    @Body() body: RegisterWithEmailDto | RegisterWithInviteDto,
  ): Promise<AuthResponseDto> {
    // Check if this is an invite registration
    if ('invitationToken' in body) {
      const invitedUser = await this.usersService.createUserFromInvite(
        body.invitationToken,
        body.password,
      );

      const accessToken = this.authService.createAccessToken(
        invitedUser.id,
        invitedUser.email,
        invitedUser.roles,
      );

      return { accessToken };
    }

    const user = await this.usersService.createUser(body.email, body.password);
    const accessToken = this.authService.createAccessToken(
      user.id,
      user.email,
      user.roles,
    );

    return { accessToken };
  }
}
