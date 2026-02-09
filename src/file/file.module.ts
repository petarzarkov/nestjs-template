import { Module } from '@nestjs/common';
import { FileEntity } from '@/file/entity/file.entity';
import { FilesRepository } from '@/file/repos/file.repository';
import { DatabaseModule } from '@/infra/db/database.module';
import { FileController } from './file.controller';
import { FileService } from './services/file.service';
import { S3Service } from './services/s3.service';

@Module({
  imports: [DatabaseModule, DatabaseModule.forFeature([FileEntity])],
  controllers: [FileController],
  providers: [FileService, S3Service, FilesRepository],
  exports: [S3Service, FilesRepository, FileService],
})
export class FileModule {}
