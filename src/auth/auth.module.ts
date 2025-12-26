import { DynamicModule, forwardRef, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigModule } from '@/config/app.config.module';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { DatabaseModule } from '@/db/database.module';
import { UsersModule } from '@/users/users.module';
import { AuthController } from './auth.controller';
import { AuthProvider } from './entity/auth-provider.entity';
import { AuthProvidersRepository } from './repos/auth-providers.repository';
import { AuthService } from './services/auth.service';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    const providers: Provider[] = [
      AuthService,
      LocalStrategy,
      JwtStrategy,
      AuthProvidersRepository,
    ];

    const exports: (string | symbol | Provider)[] = [
      AuthService,
      JwtModule,
      LocalStrategy,
      JwtStrategy,
      AuthProvidersRepository,
    ];

    // Conditionally register OAuth strategies based on environment variables
    // Check each provider individually - only register if both client ID and secret are present
    const hasGoogleOAuth =
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const hasGithubOAuth =
      process.env.GITHUB_OAUTH_CLIENT_ID &&
      process.env.GITHUB_OAUTH_CLIENT_SECRET;
    const hasLinkedInOAuth =
      process.env.LINKEDIN_OAUTH_CLIENT_ID &&
      process.env.LINKEDIN_OAUTH_CLIENT_SECRET;

    if (hasGoogleOAuth) {
      providers.push(GoogleStrategy);
      exports.push(GoogleStrategy);
    }

    if (hasGithubOAuth) {
      providers.push(GithubStrategy);
      exports.push(GithubStrategy);
    }

    if (hasLinkedInOAuth) {
      providers.push(LinkedInStrategy);
      exports.push(LinkedInStrategy);
    }

    return {
      module: AuthModule,
      imports: [
        forwardRef(() => UsersModule),
        DatabaseModule.forFeature([AuthProvider]),
        PassportModule,
        JwtModule.registerAsync({
          imports: [AppConfigModule],
          useFactory: async (
            configService: AppConfigService<ValidatedConfig>,
          ) => ({
            secret: configService.getOrThrow('jwt.secret'),
            signOptions: {
              expiresIn: configService.getOrThrow('jwt.expiration'),
            },
          }),
          inject: [AppConfigService],
        }),
      ],
      providers,
      controllers: [AuthController],
      exports,
    };
  }
}
