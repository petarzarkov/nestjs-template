import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  GetObjectCommand,
  GetObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as mime from 'mime-types';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';

export interface S3FileDto {
  fileId: string;
  userId: string;
  file: Express.Multer.File;
  context: string;
}

@Injectable()
export class S3Service {
  private bucketName: string;
  private region: string;
  private s3: S3Client;

  constructor(
    private readonly configService: AppConfigService,
    private readonly logger: ContextLogger,
  ) {
    this.bucketName = this.configService.get('aws.s3BucketName');
    this.region = this.configService.get('aws.region');

    const accessKeyId = this.configService.get('aws.accessKeyId');
    const secretAccessKey = this.configService.get('aws.secretAccessKey');

    this.s3 = new S3Client({
      region: this.region,
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
          },
        }),
    });
  }

  async upsertFile(payload: S3FileDto) {
    const { file, fileId } = payload;
    const { path, name, extension, mimetype } =
      this.#constructFileData(payload);
    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: path,
      Body: file.buffer,
      ContentType: mimetype,
    };

    try {
      const command = new PutObjectCommand(params);
      const response = await this.s3.send(command);

      this.logger.debug(`S3 file ${path} saved`, response);

      return { fileId, path, name, extension, mimetype };
    } catch (err) {
      this.logger.error('S3 file save error', err);
      throw new InternalServerErrorException(
        `${file.originalname} failed to save`,
      );
    }
  }

  async downloadFileByPath(filePath: string): Promise<{
    stream: Readable;
    contentType: string;
    contentLength?: number;
  }> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: filePath,
      };
      const command = new GetObjectCommand(params);
      const response: GetObjectCommandOutput = await this.s3.send(command);
      if (!response.Body) {
        throw new InternalServerErrorException(
          `File ${filePath} not found or failed to download`,
        );
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength,
      };
    } catch (err) {
      this.logger.error('S3 file download error', err);
      throw new InternalServerErrorException(
        `File ${filePath} failed to download`,
      );
    }
  }

  async deleteFileByPath(filePath: string): Promise<void> {
    const params: DeleteObjectCommandInput = {
      Bucket: this.bucketName,
      Key: filePath,
    };

    try {
      const command = new DeleteObjectCommand(params);
      const response = await this.s3.send(command);

      this.logger.debug(`S3 file ${filePath} deleted`, response);
    } catch (err) {
      this.logger.error('S3 file delete error', err);
      throw new InternalServerErrorException(
        `File ${filePath} failed to delete`,
      );
    }
  }

  #constructFileData(payload: S3FileDto) {
    const { fileId, userId, file, context } = payload;
    const originalname = file.originalname;
    const lastDotIndex = originalname.lastIndexOf('.');
    const hasExtension = lastDotIndex !== -1 && lastDotIndex !== 0;

    const name = hasExtension
      ? originalname.slice(0, lastDotIndex)
      : originalname;
    const fileExtensionFromFile = hasExtension
      ? originalname.slice(lastDotIndex + 1)
      : null;

    const extension =
      fileExtensionFromFile ||
      mime.extension(file.mimetype) ||
      file.mimetype.split('/')[1];

    this.logger.debug('File extension extracted', {
      fileOriginalname: originalname,
      fileFilename: file.filename,
      fileMimetype: file.mimetype,
      fileExtensionFromFile,
      mimeExtension: mime.extension(file.mimetype),
      mimetypeExtension: file.mimetype.split('/')[1],
      extension,
    });

    return {
      path: `users/${userId}/${context}/${name}-${fileId}.${extension}`,
      name,
      extension,
      mimetype: file.mimetype,
    };
  }
}
