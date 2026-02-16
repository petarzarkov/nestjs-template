import { applyDecorators } from '@nestjs/common';
import type { ApiPropertyOptions } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  NotContains,
} from 'class-validator';
import { STRING_LENGTH } from '@/constants';

export const IsEmailDecorator = (
  optional = false,
  description: string = 'The email address of the user.',
  opts?: ApiPropertyOptions,
) => {
  const decorators = [
    ApiProperty({
      ...opts,
      description,
      required: !optional,
      type: 'string',
      format: 'email',
      example: 'test@test.com',
      maxLength: STRING_LENGTH.EMAIL_MAX,
    }),
    NotContains(' ', {
      message: 'Email address cannot contain spaces',
    }),
    IsEmail(),
    MaxLength(STRING_LENGTH.EMAIL_MAX),
  ];

  decorators.push(optional ? IsOptional() : IsNotEmpty());
  return applyDecorators(...decorators);
};
