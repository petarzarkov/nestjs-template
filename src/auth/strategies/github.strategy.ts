import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { VerifyCallback } from 'passport-oauth2';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { OAuthProvider } from '../enum/oauth-provider.enum';
import { AuthService } from '../services/auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(
  Strategy,
  OAuthProvider.GITHUB,
) {
  constructor(
    readonly configService: AppConfigService<ValidatedConfig>,
    private readonly authService: AuthService,
    private readonly logger: ContextLogger,
  ) {
    const oauthConfig = configService.get('oauth.github');
    if (!oauthConfig) {
      throw new Error('GitHub OAuth config not found');
    }

    super({
      clientID: oauthConfig.clientId,
      clientSecret: oauthConfig.clientSecret,
      callbackURL: oauthConfig.callbackUrl,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, displayName, emails, photos } = profile;

    const email = emails?.[0]?.value;
    if (!email) {
      this.logger.error('GitHub profile did not return an email.');
      return done(
        new UnauthorizedException('Email not provided by GitHub'),
        false,
      );
    }

    try {
      const user = await this.authService.createOrUpdateUserOAuth(
        id,
        OAuthProvider.GITHUB,
        email,
        displayName || email.split('@')[0],
        photos?.[0]?.value || null,
      );

      done(null, user);
    } catch (err) {
      this.logger.error('Error during GitHub OAuth validation', { error: err });
      done(err, false);
    }
  }
}
