import { Profile as GithubProfile } from 'passport-github2';
import { Profile } from 'passport-google-oauth20';
import { OAuthProvider } from '../enum/oauth-provider.enum';
import { LinkedInOidcProfile } from '../strategies/linkedin/linkedin.local.strategy';

export type ProviderMetadata =
  | { provider: OAuthProvider.GOOGLE; profile: Profile }
  | { provider: OAuthProvider.GITHUB; profile: GithubProfile }
  | { provider: OAuthProvider.LINKEDIN; profile: LinkedInOidcProfile }
  | { provider: OAuthProvider.LOCAL; profile: null };
