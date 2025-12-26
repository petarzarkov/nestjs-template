import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBody,
  ApiExcludeEndpoint,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
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
import { OAuthProvider } from './enum/oauth-provider.enum';
import { AuthService } from './services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  private handleOAuthCallback(req: Request): AuthResponseDto {
    if (!req.user) {
      throw new UnauthorizedException(
        'No user data received from OAuth provider',
      );
    }
    const user = req.user;
    const accessToken = this.authService.createAccessToken(
      user.id,
      user.email,
      user.roles,
    );
    return { accessToken };
  }

  @Post('login')
  @UseGuards(AuthGuard(OAuthProvider.LOCAL))
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

  @UseGuards(AuthGuard(OAuthProvider.GOOGLE))
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth2 login flow' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to Google for authentication',
  })
  async loginGoogle() {
    // Passport strategy handles the redirect
  }

  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth2 callback URL' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns JWT token after successful login',
    type: AuthResponseDto,
  })
  @ApiExcludeEndpoint()
  async googleAuthCallback(@Req() req: Request) {
    return this.handleOAuthCallback(req);
  }

  @UseGuards(AuthGuard(OAuthProvider.GITHUB))
  @Get('github')
  @ApiOperation({ summary: 'Initiate GitHub OAuth2 login flow' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to GitHub for authentication',
  })
  async loginGithub() {
    // Passport strategy handles the redirect
  }

  @UseGuards(AuthGuard(OAuthProvider.GITHUB))
  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth2 callback URL' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns JWT token after successful login',
    type: AuthResponseDto,
  })
  @ApiExcludeEndpoint()
  async githubAuthCallback(@Req() req: Request) {
    return this.handleOAuthCallback(req);
  }

  @UseGuards(AuthGuard(OAuthProvider.LINKEDIN))
  @Get('linkedin')
  @ApiOperation({ summary: 'Initiate LinkedIn OAuth2 login flow' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to LinkedIn for authentication',
  })
  async loginLinkedIn() {
    // Passport strategy handles the redirect
  }

  @UseGuards(AuthGuard(OAuthProvider.LINKEDIN))
  @Get('linkedin/callback')
  @ApiOperation({ summary: 'LinkedIn OAuth2 callback URL' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns JWT token after successful login',
    type: AuthResponseDto,
  })
  @ApiExcludeEndpoint()
  async linkedInAuthCallback(@Req() req: Request) {
    return this.handleOAuthCallback(req);
  }
}
