import OAuth2Strategy, {
  InternalOAuthError,
  StrategyOptions,
  VerifyFunction,
} from 'passport-oauth2';
import { ParamsType } from '@/core/helpers/types/params.type';

export interface LinkedInOidcProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  email?: string;
  email_verified?: boolean;
}

export interface LinkedInStrategyOptions {
  clientID: string;
  clientSecret: string;
  callbackURL?: string | undefined;
  scope?: string | string[];
  profileFields?: string[];
  customHeaders?: Record<string, string>;
  state?: boolean | string;
  authorizationURL?: string;
  tokenURL?: string;
  profileURL?: string;
}

export class LinkedInLocalStrategy extends OAuth2Strategy {
  name: string;
  profileUrl: string;
  options: LinkedInStrategyOptions;

  constructor(options: LinkedInStrategyOptions, verify: VerifyFunction) {
    const opts: LinkedInStrategyOptions & StrategyOptions = {
      ...options,
      authorizationURL:
        options.authorizationURL ||
        'https://www.linkedin.com/oauth/v2/authorization',
      tokenURL:
        options.tokenURL || 'https://www.linkedin.com/oauth/v2/accessToken',
      scope: options.scope || ['openid', 'profile', 'email'],
      customHeaders: { 'x-li-format': 'json', ...options.customHeaders },
    };

    super(opts, verify);

    this.options = opts;
    this.name = 'linkedin';
    this.profileUrl = opts.profileURL || 'https://api.linkedin.com/v2/userinfo';

    this._oauth2.setAccessTokenName('oauth2_access_token');
  }

  public userProfile(
    accessToken: string,
    done: (err?: Error | null, profile?: LinkedInOidcProfile) => void,
  ): void {
    this._oauth2.get(
      this.profileUrl,
      accessToken,
      (err: unknown, body?: string | Buffer, _res?: unknown) => {
        if (err) {
          return done(
            new InternalOAuthError('Failed to fetch user profile', err),
          );
        }

        if (!body) {
          return done(
            new InternalOAuthError(
              'Failed to fetch user profile, empty response body',
              null,
            ),
          );
        }

        try {
          const profile = JSON.parse(body.toString()) as LinkedInOidcProfile;
          done(null, profile);
        } catch (ex: unknown) {
          return done(
            new InternalOAuthError(
              'Failed to parse profile response',
              ex instanceof Error ? ex : new Error(String(ex)),
            ),
          );
        }
      },
    );
  }

  public authorizationParams(options: { state?: string }) {
    const params: ParamsType = {};
    if (options.state) {
      params.state = options.state;
    }

    return params;
  }
}
