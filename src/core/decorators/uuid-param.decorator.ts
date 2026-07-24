import type { ExecutionContext } from '@nestjs/common';
import { BadRequestException, createParamDecorator } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { isUuid } from '@/core/utils/uuid.util';

export interface UuidParamOptions {
  name: string;
  description?: string;
  example?: string;
}

export const UuidParam = (options: UuidParamOptions) => {
  const { name } = options;

  return createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
      const request = ctx.switchToHttp().getRequest();
      const paramValue = request.params[name];

      if (!paramValue) {
        throw new BadRequestException(`Parameter '${name}' is required`);
      }

      if (!isUuid(paramValue)) {
        throw new BadRequestException(
          `Parameter '${name}' must be a valid UUID`,
        );
      }

      return paramValue;
    },
  )();
};

// Utility function to generate ApiParam decorators for UUID parameters
export const ApiUuidParam = (options: UuidParamOptions) => {
  const { name, description, example } = options;

  return ApiParam({
    name,
    description: description || `${name} (UUID format)`,
    type: String,
    format: 'uuid',
    example: example || 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: true,
  });
};
