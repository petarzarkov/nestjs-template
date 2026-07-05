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
