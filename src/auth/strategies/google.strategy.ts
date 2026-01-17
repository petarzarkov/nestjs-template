import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { OAuthProvider } from '../enum/oauth-provider.enum';
import { AuthService } from '../services/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  OAuthProvider.GOOGLE,
) {
  constructor(
    readonly configService: AppConfigService<ValidatedConfig>,
    private readonly authService: AuthService,
    private readonly logger: ContextLogger,
  ) {
    const oauthConfig = configService.get('oauth.google');
    if (!oauthConfig) {
      throw new Error('Google OAuth config not found');
    }

    super({
      clientID: oauthConfig.clientId,
      clientSecret: oauthConfig.clientSecret,
      callbackURL: oauthConfig.callbackUrl,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string | undefined,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, displayName, emails, photos } = profile;
    if (!emails || emails.length === 0 || !emails[0].value) {
      this.logger.error('Google profile did not return an email.');
      return done(
        new UnauthorizedException('Email not provided by Google.'),
        false,
      );
    }

    const email = emails[0].value;
    const picture = photos && photos.length > 0 ? photos[0].value : null;

    try {
      const user = await this.authService.createOrUpdateUserOAuth(
        id,
        OAuthProvider.GOOGLE,
        email,
        displayName || email.split('@')[0],
        picture,
      );

      done(null, user);
    } catch (err) {
      this.logger.error('Error during Google OAuth validation', { error: err });
      done(err, false);
    }
  }
}
