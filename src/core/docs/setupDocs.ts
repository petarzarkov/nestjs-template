import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { ValidatedConfig } from '@/config/env.validation';
import { PackageJson } from '@/config/PackageJson';
import { GLOBAL_PREFIX } from '@/constants';
import { HtmlBasicAuthMiddleware } from '../middlewares/html-basic-auth.middleware';

export function setupDocs(
  app: INestApplication,
  pkg: PackageJson,
  appConfig: ValidatedConfig['app'],
) {
  const SWAGGER_PATH = `/${GLOBAL_PREFIX}/docs`;
  const htmlBasicAuthMiddleware = app.get(HtmlBasicAuthMiddleware);

  app.use(
    [SWAGGER_PATH, `${SWAGGER_PATH}-json`],
    htmlBasicAuthMiddleware.use.bind(htmlBasicAuthMiddleware),
  );

  const title = `${appConfig.name} ${appConfig.env}`;
  const swaggerConfig = new DocumentBuilder()
    .setTitle(title)
    .setDescription(pkg.description)
    .setVersion(appConfig.version)
    .setContact(pkg.author.name, pkg.author.url, pkg.author.email)
    .addBearerAuth(
      {
        type: 'http',
        in: 'header',
        bearerFormat: 'JWT',
        scheme: 'bearer',
        name: 'Authorization',
        description: 'Enter your access token',
      },
      'bearerAuth',
    )
    .addSecurityRequirements('bearerAuth')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: title,
    customCss: '.swagger-ui .topbar { display: none }',
    customfavIcon: appConfig.logoUrl,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      docExpansion: 'none',
      responseInterceptor: function setBearerOnLogin(response: {
        ok: boolean;
        url: string | string[];
        body: { accessToken: string };
      }) {
        if (
          response.ok &&
          (response?.url?.includes('/api/auth/login') ||
            response?.url?.includes('/api/auth/register'))
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

  const SCALAR_PATH = `/${GLOBAL_PREFIX}/public`;
  app.use(
    SCALAR_PATH,
    apiReference({
      title: 'Template API',
      slug: 'template-api',
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      pageTitle: 'Template API',
      favicon: appConfig.logoUrl,
      content: document,
      hideModels: true,
      hideClientButton: true,
    }),
  );
  return { title, swaggerPath: SWAGGER_PATH, scalarPath: SCALAR_PATH };
}
