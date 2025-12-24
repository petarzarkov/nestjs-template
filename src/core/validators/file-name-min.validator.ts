import path from 'node:path';
import { FileValidator } from '@nestjs/common';

interface FileNameMinValidatorOptions {
  minLength: number;
}

export class FileNameMinValidator extends FileValidator<
  FileNameMinValidatorOptions,
  Express.Multer.File
> {
  isValid(file?: Express.Multer.File | Express.Multer.File[]): boolean {
    if (!file) {
      return false;
    }

    if (Array.isArray(file)) {
      return file.every(f => this.validateSingleFile(f));
    }

    return this.validateSingleFile(file);
  }

  private validateSingleFile(file: Express.Multer.File): boolean {
    if (!file?.originalname) {
      return false;
    }

    // Extract filename without extension
    const nameWithoutExtension = path.parse(file.originalname).name;
    return nameWithoutExtension.length >= this.validationOptions.minLength;
  }

  buildErrorMessage(file: Express.Multer.File): string {
    const nameWithoutExtension = file?.originalname
      ? path.parse(file.originalname).name
      : 'unknown';

    return `File name "${nameWithoutExtension}" must be at least ${this.validationOptions.minLength} characters long (without extension)`;
  }
}
