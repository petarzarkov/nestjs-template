import { applyDecorators } from '@nestjs/common';
import type { ValidationOptions } from 'class-validator';
import { IsArray, IsEnum } from 'class-validator';

export function IsUniqueEnumArrayDecorator(
  enumType: Record<string, string | number>,
  validationOptions?: ValidationOptions,
) {
  return applyDecorators(
    IsArray(validationOptions),
    IsEnum(enumType, {
      ...validationOptions,
      each: true,
    }),
  );
}
