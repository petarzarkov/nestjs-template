import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Auth } from '@/auth/auth.config';
import { ValidatedConfig } from '@/config/env.validation';
import { PackageJson } from '@/config/PackageJson';
import { GLOBAL_PREFIX } from '@/constants';
import { HtmlSessionAuthMiddleware } from '../middlewares/html-session-auth.middleware';

export async function setupDocs(
  app: INestApplication,
  pkg: PackageJson,
  appConfig: ValidatedConfig['app'],
  auth: Auth,
) {
  const SWAGGER_PATH = `/${GLOBAL_PREFIX}/docs`;
  const htmlSessionAuthMiddleware = app.get(HtmlSessionAuthMiddleware);

  app.use(
    [SWAGGER_PATH, `${SWAGGER_PATH}-json`],
    htmlSessionAuthMiddleware.use.bind(htmlSessionAuthMiddleware),
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
        scheme: 'bearer',
        name: 'Authorization',
        description: 'Enter your Better Auth session token',
      },
      'bearerAuth',
    )
    .addSecurityRequirements('bearerAuth')
    // Consumed by @arkv/nestjs-cms so its UI can authenticate against this API.
    // Better Auth sign-in returns the session token in `token` (bearer plugin).
    .addExtension(
      'x-cms-login-endpoint',
      `/${GLOBAL_PREFIX}/auth/sign-in/email`,
    )
    .addExtension('x-cms-token-path', 'token')
    .build();

  // cleanupOpenApiDoc resolves the Zod-generated schemas (nestjs-zod) into a
  // clean OpenAPI document, consumed by Swagger, Scalar, and the CMS.
  const document = cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await mergeBetterAuthSchema(document, auth);

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
        body: { token: string };
      }) {
        if (
          response.ok &&
          (response?.url?.includes('/api/auth/sign-in/email') ||
            response?.url?.includes('/api/auth/sign-up/email'))
        ) {
          (
            window as unknown as Window & {
              ui: {
                preauthorizeApiKey: (name: string, apiKey: string) => void;
              };
            }
          ).ui.preauthorizeApiKey('bearerAuth', response.body.token);
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
      defaultOpenAllTags: false,
      expandAllModelSections: false,
      expandAllResponses: false,
      persistAuth: true,
      telemetry: false,
      theme: 'elysiajs',
      darkMode: true,
    }),
  );
  return {
    title,
    document,
    swaggerPath: SWAGGER_PATH,
    scalarPath: SCALAR_PATH,
  };
}

const OPENAPI_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
] as const;

/**
 * Merges the Better Auth OpenAPI schema (from the `openAPI()` plugin) into the
 * app's Swagger document, so the `/api/auth/*` routes — served by Better Auth's
 * middleware rather than NestJS controllers — show up in `/api/docs` under an
 * "Auth" tag. Best-effort: a failure here never blocks bootstrap.
 */
async function mergeBetterAuthSchema(
  document: OpenAPIObject,
  auth: Auth,
): Promise<void> {
  try {
    const authPrefix = `/${GLOBAL_PREFIX}/auth`;
    const schema = (await auth.api.generateOpenAPISchema()) as unknown as {
      paths?: Record<string, Record<string, { tags?: string[] } | undefined>>;
      components?: { schemas?: Record<string, unknown> };
    };

    document.paths ??= {};
    for (const [path, pathItem] of Object.entries(schema.paths ?? {})) {
      const fullPath = path.startsWith(authPrefix)
        ? path
        : `${authPrefix}${path}`;
      for (const method of OPENAPI_METHODS) {
        const operation = pathItem[method];
        if (operation) {
          operation.tags = ['auth'];
        }
      }
      document.paths[fullPath] = pathItem as OpenAPIObject['paths'][string];
    }

    const authSchemas = schema.components?.schemas;
    if (authSchemas) {
      const components = (document.components ??= {});
      components.schemas = {
        ...components.schemas,
        ...(authSchemas as NonNullable<OpenAPIObject['components']>['schemas']),
      };
    }
  } catch {
    // Non-fatal: auth routes simply won't appear in Swagger.
  }
}
