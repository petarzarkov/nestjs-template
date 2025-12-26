import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { VerifyCallback } from 'passport-oauth2';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { OAuthProvider } from '../enum/oauth-provider.enum';
import { AuthService } from '../services/auth.service';
import {
  LinkedInLocalStrategy,
  LinkedInOidcProfile,
} from './linkedin/linkedin.local.strategy';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(
  LinkedInLocalStrategy,
  OAuthProvider.LINKEDIN,
) {
  constructor(
    readonly configService: AppConfigService<ValidatedConfig>,
    private readonly authService: AuthService,
    private readonly logger: ContextLogger,
  ) {
    const oauthConfig = configService.get('oauth.linkedin');
    if (!oauthConfig) {
      throw new Error('LinkedIn OAuth config not found');
    }

    super({
      clientID: oauthConfig.clientId,
      clientSecret: oauthConfig.clientSecret,
      callbackURL: oauthConfig.callbackUrl,
      scope: ['openid', 'email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: LinkedInOidcProfile,
    done: VerifyCallback,
  ) {
    const { sub: id, name, email, picture } = profile;

    if (!email) {
      this.logger.error('LinkedIn profile did not return an email.');
      return done(
        new UnauthorizedException('Email not provided by LinkedIn'),
        false,
      );
    }

    try {
      const user = await this.authService.createOrUpdateUserOAuth(
        id,
        OAuthProvider.LINKEDIN,
        email,
        name || email.split('@')[0],
        picture || null,
      );

      done(null, user);
    } catch (err) {
      this.logger.error('Error during LinkedIn OAuth validation', {
        error: err,
      });
      done(err, false);
    }
  }
}
