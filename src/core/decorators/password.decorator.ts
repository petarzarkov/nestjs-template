import { BASE_USER_TEST_PASS } from '@/constants';
import { applyDecorators } from '@nestjs/common';
import type { ApiPropertyOptions } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';

export const PasswordDecorator = (
  optional = false,
  description: string = 'Password.',
  opts?: ApiPropertyOptions,
) => {
  const decorators = [
    ApiProperty({
      ...opts,
      description,
      required: !optional,
      type: 'string',
      format: 'password',
      example: BASE_USER_TEST_PASS,
    }),
    IsString(),
    MaxLength(64, { message: 'Password must be at most 64 characters' }),
    IsStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    }),
  ];

  decorators.push(optional ? IsOptional() : IsNotEmpty());
  return applyDecorators(...decorators);
};
