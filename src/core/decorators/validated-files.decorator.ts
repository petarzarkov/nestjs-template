import { FILES } from '@/constants';
import { FileNameMinValidator } from '@/core/validators/file-name-min.validator';
import { FileSizeMinValidator } from '@/core/validators/file-size-min.validator';
import { ParseFilePipeBuilder, UploadedFile, UploadedFiles } from '@nestjs/common';

interface ValidatedFilesOptions {
  fileType: string | RegExp;
  minSize?: number;
  maxSize?: number;
  minFileNameLength?: number;
}

export const validatedFilePipe = (options: ValidatedFilesOptions) => {
  return new ParseFilePipeBuilder()
    .addFileTypeValidator({
      fileType: options.fileType,
      // https://github.com/nestjs/nest/issues/14970 we need to skip magic numbers validation
      skipMagicNumbersValidation: true,
    })
    .addValidator(
      new FileSizeMinValidator({
        minSize: options.minSize || FILES.MIN_SIZE,
      })
    )
    .addValidator(
      new FileNameMinValidator({
        minLength: options.minFileNameLength || FILES.MIN_FILE_NAME_LENGTH,
      })
    )
    .addMaxSizeValidator({ maxSize: options.maxSize || FILES.MAX_SIZE })
    .build();
};

export function ValidatedFile(options: ValidatedFilesOptions) {
  return UploadedFile(validatedFilePipe(options));
}

export function ValidatedFiles(options: ValidatedFilesOptions) {
  return UploadedFiles(validatedFilePipe(options));
}
