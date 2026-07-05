import { Module } from '@nestjs/common';
import { FilesRepository } from '@/file/repos/file.repository';
import { FileController } from './file.controller';
import { FileService } from './services/file.service';
import { S3Service } from './services/s3.service';

@Module({
  controllers: [FileController],
  providers: [FileService, S3Service, FilesRepository],
  exports: [S3Service, FilesRepository, FileService],
})
export class FileModule {}
