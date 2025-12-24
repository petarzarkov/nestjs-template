import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

export const ApiJwtAuth = (availableFor?: string) => {
  const decorators: MethodDecorator[] = [ApiBearerAuth('bearerAuth')];
  if (availableFor) {
    decorators.push(
      ApiOperation({ summary: `Available for "${availableFor}"` }),
    );
  }

  return applyDecorators(...decorators);
};
