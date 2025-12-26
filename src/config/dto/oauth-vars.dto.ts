import { IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GoogleOAuthVars {
  @IsString()
  @IsOptional()
  GOOGLE_OAUTH_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
}

export class GitHubOAuthVars {
  @IsString()
  @IsOptional()
  GITHUB_OAUTH_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GITHUB_OAUTH_CLIENT_SECRET?: string;
}

export class LinkedInOAuthVars {
  @IsString()
  @IsOptional()
  LINKEDIN_OAUTH_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  LINKEDIN_OAUTH_CLIENT_SECRET?: string;
}

export class OAuthVars extends IntersectionType(
  GoogleOAuthVars,
  GitHubOAuthVars,
  LinkedInOAuthVars,
) {}

export const getOAuthConfig = (
  config: OAuthVars,
  webUrl: string,
  apiPath: string,
): {
  google?: { clientId: string; clientSecret: string; callbackUrl: string };
  github?: { clientId: string; clientSecret: string; callbackUrl: string };
  linkedin?: { clientId: string; clientSecret: string; callbackUrl: string };
} => {
  const baseUrl = webUrl;
  const oauth: ReturnType<typeof getOAuthConfig> = {};

  if (config.GOOGLE_OAUTH_CLIENT_ID && config.GOOGLE_OAUTH_CLIENT_SECRET) {
    oauth.google = {
      clientId: config.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: config.GOOGLE_OAUTH_CLIENT_SECRET,
      callbackUrl: `${baseUrl}/${apiPath}/auth/google/callback`,
    };
  }

  if (config.GITHUB_OAUTH_CLIENT_ID && config.GITHUB_OAUTH_CLIENT_SECRET) {
    oauth.github = {
      clientId: config.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: config.GITHUB_OAUTH_CLIENT_SECRET,
      callbackUrl: `${baseUrl}/${apiPath}/auth/github/callback`,
    };
  }

  if (config.LINKEDIN_OAUTH_CLIENT_ID && config.LINKEDIN_OAUTH_CLIENT_SECRET) {
    oauth.linkedin = {
      clientId: config.LINKEDIN_OAUTH_CLIENT_ID,
      clientSecret: config.LINKEDIN_OAUTH_CLIENT_SECRET,
      callbackUrl: `${baseUrl}/${apiPath}/auth/linkedin/callback`,
    };
  }

  return oauth;
};
