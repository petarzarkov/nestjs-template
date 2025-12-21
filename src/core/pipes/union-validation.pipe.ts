import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

type ClassConstructor = new () => object;

interface UnionValidationOptions {
  discriminator: (body: object) => ClassConstructor | null;
  types: ClassConstructor[];
}

@Injectable()
export class UnionValidationPipe implements PipeTransform {
  constructor(private readonly options: UnionValidationOptions) {}

  async transform(value: object) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Request body must be an object');
    }

    const targetType = this.options.discriminator(value);
    if (!targetType) {
      throw new BadRequestException('Cannot determine request type');
    }

    const transformedValue = plainToInstance(targetType, value);
    const errors = await validate(transformedValue);

    const errorMessages = errors.flatMap(
      ({ constraints }) => constraints && Object.values(constraints)
    );
    if (errorMessages.length > 0) {
      throw new BadRequestException(errorMessages.join(', '));
    }

    return transformedValue;
  }
}
