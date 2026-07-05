import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { HelpersService } from '@/core/helpers/services/helpers.service';
import { FileEntity } from '@/file/entity/file.entity';
import { FilesRepository } from '@/file/repos/file.repository';
import { ContextLogger } from '@arkv/nestjs-context-logger';
import { SanitizedUser } from '@/users/entity/user.entity';
import { UserRole } from '@/users/enum/user-role.enum';
import { FileService } from './file.service';
import { S3Service } from './s3.service';

// Mock readable stream helper
const createMockStream = (data: string = 'test') => {
  const stream = new Readable();
  stream.push(data);
  stream.push(null); // End of stream
  return stream;
};

describe('FileService', () => {
  let service: FileService;
  const s3Service = {
    upsertFile: mock(),
    downloadFileByPath: mock(),
    deleteFileByPath: mock(),
  };
  const filesRepository = {
    create: mock(),
    save: mock(),
    findExisting: mock(),
    findById: mock(),
    deleteById: mock(),
  };
  const helpersService = {
    isSupportedImageType: mock(),
    calculateImageSize: mock(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: S3Service,
          useValue: s3Service,
        },
        {
          provide: FilesRepository,
          useValue: filesRepository,
        },
        {
          provide: HelpersService,
          useValue: helpersService,
        },
        {
          provide: ContextLogger,
          useValue: {
            info: mock(() => undefined),
            log: mock(() => undefined),
            debug: mock(() => undefined),
            warn: mock(() => undefined),
            error: mock(() => undefined),
          },
        },
      ],
    }).compile();

    service = module.get(FileService);
  });

  afterEach(() => {
    s3Service.upsertFile.mockClear();
    s3Service.downloadFileByPath.mockClear();
    s3Service.deleteFileByPath.mockClear();
    filesRepository.create.mockClear();
    filesRepository.save.mockClear();
    filesRepository.findExisting.mockClear();
    filesRepository.findById.mockClear();
    filesRepository.deleteById.mockClear();
    helpersService.isSupportedImageType.mockClear();
    helpersService.calculateImageSize.mockClear();
  });

  describe('upload', () => {
    it('should upload new files to S3 and insert metadata in DB', async () => {
      const mockFiles: Express.Multer.File[] = [
        {
          originalname: 'file1.png',
          buffer: Buffer.from(''),
          mimetype: 'image/png',
        } as Express.Multer.File,
        {
          originalname: 'document.pdf',
          buffer: Buffer.from(''),
          mimetype: 'application/pdf',
        } as Express.Multer.File,
      ];

      const mockS3Responses = [
        {
          fileId: 'file-id-1',
          path: 'userId/file1.png',
          name: 'file1',
          extension: 'png',
          mimetype: 'image/png',
        },
        {
          fileId: 'file-id-2',
          path: 'userId/document.pdf',
          name: 'document',
          extension: 'pdf',
          mimetype: 'application/pdf',
        },
      ];

      const mockEntities = [
        {
          id: 'file-id-1',
          path: 'userId/file1.png',
          name: 'file1',
          extension: 'png',
          mimetype: 'image/png',
          userId: 'mockUserId',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'file-id-2',
          path: 'userId/document.pdf',
          name: 'document',
          extension: 'pdf',
          mimetype: 'application/pdf',
          userId: 'mockUserId',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      s3Service.upsertFile
        .mockResolvedValueOnce(mockS3Responses[0])
        .mockResolvedValueOnce(mockS3Responses[1]);

      // No existing files → insert path
      filesRepository.findExisting.mockReturnValue(null);
      helpersService.isSupportedImageType.mockReturnValue(true);
      helpersService.calculateImageSize
        .mockReturnValueOnce({ width: 100, height: 200 })
        .mockReturnValueOnce(null); // PDFs have no image dimensions

      filesRepository.create
        .mockReturnValueOnce(mockEntities[0])
        .mockReturnValueOnce(mockEntities[1]);

      const result = await service.upload('mockUserId', mockFiles);

      expect(s3Service.upsertFile).toHaveBeenCalledTimes(2);
      expect(filesRepository.findExisting).toHaveBeenCalledTimes(2);
      expect(filesRepository.findExisting).toHaveBeenCalledWith({
        extension: 'png',
        name: 'file1',
        userId: 'mockUserId',
        size: undefined,
      });

      expect(filesRepository.create).toHaveBeenCalledWith({
        id: 'file-id-1',
        path: 'userId/file1.png',
        name: 'file1',
        extension: 'png',
        mimetype: 'image/png',
        userId: 'mockUserId',
        width: 100,
        height: 200,
        size: undefined,
      });
      expect(filesRepository.create).toHaveBeenCalledWith({
        id: 'file-id-2',
        path: 'userId/document.pdf',
        name: 'document',
        extension: 'pdf',
        mimetype: 'application/pdf',
        userId: 'mockUserId',
        width: null,
        height: null,
        size: undefined,
      });

      expect(filesRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(mockEntities as FileEntity[]);
    });

    it('should update existing files when uploading with same metadata (upsert)', async () => {
      const mockFile: Express.Multer.File = {
        originalname: 'file1.png',
        buffer: Buffer.from(''),
        mimetype: 'image/png',
      } as Express.Multer.File;

      const fileId = 'file-uuid';
      const mockS3Response = {
        path: 'userId/file1.png',
        name: 'file1',
        extension: 'png',
        mimetype: 'image/png',
        fileId,
      };

      const existingEntity = {
        id: fileId,
        path: 'userId/file1.png',
        name: 'oldFile',
        extension: 'png',
        mimetype: 'image/png',
        userId: 'oldUserId',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      const updatedEntity = {
        ...existingEntity,
        name: 'file1',
        userId: 'newUserId',
        updatedAt: new Date(),
      };

      s3Service.upsertFile.mockResolvedValue(mockS3Response);
      filesRepository.findExisting.mockReturnValue(existingEntity);
      filesRepository.save.mockReturnValue(updatedEntity);
      helpersService.isSupportedImageType.mockReturnValue(true);
      helpersService.calculateImageSize.mockReturnValue({
        width: 100,
        height: 200,
      });

      const result = await service.upload('newUserId', [mockFile]);

      expect(filesRepository.create).not.toHaveBeenCalled();
      expect(filesRepository.save).toHaveBeenCalledWith({
        id: existingEntity.id,
        userId: 'newUserId',
        name: mockS3Response.name,
        extension: mockS3Response.extension,
        mimetype: mockS3Response.mimetype,
        path: mockS3Response.path,
        width: 100,
        height: 200,
        size: undefined,
      });
      expect(result).toEqual([updatedEntity] as FileEntity[]);
    });
  });

  describe('downloadById', () => {
    it('should download file by ID with stream', async () => {
      const fileId = 'test-id';
      const mockFile = {
        id: fileId,
        path: 'userId/file.png',
        name: 'file',
        extension: 'png',
        mimetype: 'image/png',
        userId: 'userId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockStream = createMockStream('file content');
      const mockDownload = {
        stream: mockStream,
        contentType: 'image/png',
        contentLength: 1234,
      };

      filesRepository.findById.mockReturnValue(mockFile);
      s3Service.downloadFileByPath.mockResolvedValue(mockDownload);

      const result = await service.downloadById(fileId);

      expect(filesRepository.findById).toHaveBeenCalledWith(fileId);
      expect(s3Service.downloadFileByPath).toHaveBeenCalledWith(mockFile.path);
      expect(result).toEqual({
        createdBy: 'userId',
        stream: mockStream,
        contentType: mockDownload.contentType,
        contentLength: mockDownload.contentLength,
        filename: 'file.png',
      });
    });

    it('should throw NotFoundException when file not found', async () => {
      const fileId = 'non-existent-id';
      filesRepository.findById.mockReturnValue(null);

      await expect(service.downloadById(fileId)).rejects.toThrow(
        'File with ID non-existent-id not found',
      );
      expect(filesRepository.findById).toHaveBeenCalledWith(fileId);
      expect(s3Service.downloadFileByPath).not.toHaveBeenCalled();
    });
  });

  describe('deleteById', () => {
    it('should delete file by ID', async () => {
      const fileId = 'test-id';
      const mockFile = {
        id: fileId,
        path: 'userId/file.png',
        name: 'file',
        extension: 'png',
        mimetype: 'image/png',
        userId: 'userId',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      filesRepository.findById.mockReturnValue(mockFile);
      s3Service.deleteFileByPath.mockResolvedValue(undefined);

      await service.deleteById(fileId, {
        id: 'userId',
        roles: [UserRole.ADMIN],
      } as SanitizedUser);

      expect(filesRepository.findById).toHaveBeenCalledWith(fileId);
      expect(s3Service.deleteFileByPath).toHaveBeenCalledWith(mockFile.path);
      expect(filesRepository.deleteById).toHaveBeenCalledWith(fileId);
    });

    it('should throw NotFoundException when file not found', async () => {
      const fileId = 'non-existent-id';
      filesRepository.findById.mockReturnValue(null);

      await expect(
        service.deleteById(fileId, {
          id: 'userId',
          roles: [UserRole.ADMIN],
        } as SanitizedUser),
      ).rejects.toThrow('File with ID non-existent-id not found');
      expect(filesRepository.findById).toHaveBeenCalledWith(fileId);
      expect(s3Service.deleteFileByPath).not.toHaveBeenCalled();
      expect(filesRepository.deleteById).not.toHaveBeenCalled();
    });
  });

  describe('filename extraction', () => {
    it('should correctly extract filename with extension', async () => {
      const fileId = 'test-id';
      const mockFile = {
        id: fileId,
        path: 'userId/complex.file.name.pdf',
        name: 'complex.file.name',
        extension: 'pdf',
        mimetype: 'application/pdf',
        userId: 'userId',
      };
      const mockDownload = {
        stream: createMockStream('file content'),
        contentType: 'application/pdf',
        contentLength: 5678,
      };

      filesRepository.findById.mockReturnValue(mockFile);
      s3Service.downloadFileByPath.mockResolvedValue(mockDownload);

      const result = await service.downloadById(fileId);

      expect(result.filename).toBe('complex.file.name.pdf');
    });

    it('should handle files without extension', async () => {
      const fileId = 'test-id';
      const mockFile = {
        id: fileId,
        path: 'userId/README',
        name: 'README',
        extension: '',
        mimetype: 'text/plain',
        userId: 'userId',
      };
      const mockDownload = {
        stream: createMockStream('file content'),
        contentType: 'text/plain',
        contentLength: 100,
      };

      filesRepository.findById.mockReturnValue(mockFile);
      s3Service.downloadFileByPath.mockResolvedValue(mockDownload);

      const result = await service.downloadById(fileId);

      expect(result.filename).toBe('README');
    });
  });
});
