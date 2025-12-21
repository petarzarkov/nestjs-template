import { FileValidator } from '@nestjs/common';

interface FileSizeMinValidatorOptions {
  minSize: number;
}

export class FileSizeMinValidator extends FileValidator<
  FileSizeMinValidatorOptions,
  Express.Multer.File
> {
  constructor(validationOptions: FileSizeMinValidatorOptions) {
    super(validationOptions);
  }

  isValid(file?: Express.Multer.File | Express.Multer.File[]): boolean {
    if (!file) {
      return false;
    }

    if (Array.isArray(file)) {
      return file.every((f) => f?.size >= this.validationOptions.minSize);
    }

    return file.size >= this.validationOptions.minSize;
  }

  buildErrorMessage(file: Express.Multer.File): string {
    return `File ${file.originalname} must not be empty (minimum size: ${this.validationOptions.minSize} bytes)`;
  }
}
