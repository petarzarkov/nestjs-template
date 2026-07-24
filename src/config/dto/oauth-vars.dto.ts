import { z } from 'zod';

export const oauthVarsSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_OAUTH_CLIENT_ID: z.string().optional(),
  LINKEDIN_OAUTH_CLIENT_SECRET: z.string().optional(),
});

export type OAuthVars = z.infer<typeof oauthVarsSchema>;

type ProviderCreds = { clientId: string; clientSecret: string };

/**
 * OAuth client credentials per provider (only present when both id + secret are
 * set). Better Auth owns the callback routes (`/api/auth/callback/<provider>`),
 * so no callback URL is configured here.
 */
export const getOAuthConfig = (
  config: OAuthVars,
): {
  google?: ProviderCreds;
  github?: ProviderCreds;
  linkedin?: ProviderCreds;
} => {
  const oauth: ReturnType<typeof getOAuthConfig> = {};

  if (config.GOOGLE_OAUTH_CLIENT_ID && config.GOOGLE_OAUTH_CLIENT_SECRET) {
    oauth.google = {
      clientId: config.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: config.GOOGLE_OAUTH_CLIENT_SECRET,
    };
  }

  if (config.GITHUB_OAUTH_CLIENT_ID && config.GITHUB_OAUTH_CLIENT_SECRET) {
    oauth.github = {
      clientId: config.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: config.GITHUB_OAUTH_CLIENT_SECRET,
    };
  }

  if (config.LINKEDIN_OAUTH_CLIENT_ID && config.LINKEDIN_OAUTH_CLIENT_SECRET) {
    oauth.linkedin = {
      clientId: config.LINKEDIN_OAUTH_CLIENT_ID,
      clientSecret: config.LINKEDIN_OAUTH_CLIENT_SECRET,
    };
  }

  return oauth;
};

export type ValidatedOAuthConfig = ReturnType<typeof getOAuthConfig>;
