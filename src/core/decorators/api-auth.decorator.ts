import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * Swagger annotation marking a route as requiring authentication. Tokens are
 * opaque Better Auth session/bearer tokens (not JWTs) — sent as
 * `Authorization: Bearer <token>`.
 */
export const ApiAuth = (availableFor?: string) => {
  const decorators: MethodDecorator[] = [ApiBearerAuth('bearerAuth')];
  if (availableFor) {
    decorators.push(
      ApiOperation({ summary: `Available for "${availableFor}"` }),
    );
  }

  return applyDecorators(...decorators);
};
