import { applyDecorators } from '@nestjs/common';
import type { ApiPropertyOptions } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, NotContains } from 'class-validator';

export const IsEmailDecorator = (
  optional = false,
  description: string = 'The email address of the user.',
  opts?: ApiPropertyOptions
) => {
  const decorators = [
    ApiProperty({
      ...opts,
      description,
      required: !optional,
      type: 'string',
      format: 'email',
      example: 'test@test.com',
    }),
    NotContains(' ', {
      message: 'Email address cannot contain spaces',
    }),
    IsEmail(),
  ];

  decorators.push(optional ? IsOptional() : IsNotEmpty());
  return applyDecorators(...decorators);
};
