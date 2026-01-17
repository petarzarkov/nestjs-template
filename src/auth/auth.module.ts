import { DynamicModule, forwardRef, Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigModule } from '@/config/app.config.module';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { DatabaseModule } from '@/infra/db/database.module';
import { UsersModule } from '@/users/users.module';
import { AuthController } from './auth.controller';
import { AuthProvider } from './entity/auth-provider.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
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
    const baseProviders: Provider[] = [
      AuthService,
      LocalStrategy,
      JwtStrategy,
      AuthProvidersRepository,
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard,
      },
      {
        provide: APP_GUARD,
        useClass: RolesGuard,
      },
    ];

    const baseExports: (string | symbol | Provider)[] = [
      AuthService,
      JwtModule,
      LocalStrategy,
      JwtStrategy,
      AuthProvidersRepository,
    ];

    // Conditionally add OAuth strategies based on env vars
    // Note: We must check process.env here because forRoot() is static
    // and runs before the DI container is ready (ConfigService not available yet)
    const conditionalProviders: Provider[] = [];

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
      conditionalProviders.push(GoogleStrategy);
    }
    if (hasGithubOAuth) {
      conditionalProviders.push(GithubStrategy);
    }
    if (hasLinkedInOAuth) {
      conditionalProviders.push(LinkedInStrategy);
    }

    return {
      module: AuthModule,
      imports: [
        forwardRef(() => UsersModule),
        DatabaseModule.forFeature([AuthProvider]),
        PassportModule,
        AppConfigModule,
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
      providers: [...baseProviders, ...conditionalProviders],
      controllers: [AuthController],
      exports: baseExports,
    };
  }
}
