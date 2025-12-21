import { AppConfigService, GLOBAL_PREFIX } from '@/config';
import { type ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { AppEnv } from '@/config/enum/app-env.enum';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import pkgJson from '../../package.json';

export function setupSwagger(app: INestApplication) {
  const SWAGGER_PATH = `/${GLOBAL_PREFIX}/api-docs`;
  const configService = app.get(AppConfigService<ValidatedServiceConfig>);
  const appConfig = configService.get('app');

  const swaggerToken = configService.get('app.swaggerToken');
  app.use(
    [SWAGGER_PATH, `${SWAGGER_PATH}-json`],
    (req: Request, res: Response, next: NextFunction) => {
      if ([AppEnv.LOCAL, AppEnv.DEV].includes(appConfig.env)) {
        return next();
      }

      if ([AppEnv.STG, AppEnv.PRD].includes(appConfig.env) && swaggerToken) {
        // Allow static asset requests (e.g., .css, .js)
        if (req.path.match(/\.(js|css|map|png|ico)$/)) {
          return next();
        }
        const token = req.query.token;
        if (token === swaggerToken) {
          return next();
        }
      }

      return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    }
  );

  const title = `${pkgJson.name} ${appConfig.env}`;
  const swaggerConfig = new DocumentBuilder()
    .setTitle(title)
    .setDescription(pkgJson.description ?? '')
    .setVersion(pkgJson.version)
    .setContact(pkgJson.author?.name ?? '', pkgJson.author?.url ?? '', pkgJson.author?.email ?? '')
    .addBearerAuth(
      {
        type: 'http',
        in: 'header',
        bearerFormat: 'JWT',
        scheme: 'bearer',
        name: 'Authorization',
        description: 'Enter your access token',
      },
      'bearerAuth'
    )
    .addSecurityRequirements('bearerAuth')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: title,
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      // Authorize the swagger UI on logging in successfully
      responseInterceptor: function setBearerOnLogin(response: {
        ok: boolean;
        url: string | string[];
        body: { accessToken: string };
      }) {
        if (
          response.ok &&
          (response?.url?.includes('api/auth/login') ||
            response?.url?.includes('api/auth/register'))
        ) {
          (
            window as unknown as Window & {
              ui: {
                preauthorizeApiKey: (name: string, apiKey: string) => void;
              };
            }
          ).ui.preauthorizeApiKey('bearerAuth', response.body.accessToken);
        }

        return response;
      },
    },
  });

  return {
    title,
    swaggerPath: SWAGGER_PATH,
  };
}
