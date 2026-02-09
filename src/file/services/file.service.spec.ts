import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Readable } from 'node:stream';
import { Test, TestingModule } from '@nestjs/testing';
import { HelpersService } from '@/core/helpers/services/helpers.service';
import { FilesRepository } from '@/file/repos/file.repository';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
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
  let s3Service = {
    upsertFile: mock(() => undefined),
    downloadFileByPath: mock(() => undefined),
    deleteFileByPath: mock(() => undefined),
  };
  let filesRepository = {
    create: mock(() => undefined),
    save: mock(() => undefined),
    findOne: mock(() => undefined),
    remove: mock(() => undefined),
  };
  let helpersService = {
    isSupportedImageType: mock(() => undefined),
    extractFilename: mock(() => undefined),
    calculateImageSize: mock(() => undefined),
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
    s3Service = module.get(S3Service);
    filesRepository = module.get(FilesRepository);
    helpersService = module.get(HelpersService);
  });

  afterEach(() => {
    // Clear mock call history between tests
    (s3Service.upsertFile as ReturnType<typeof mock>).mockClear();
    (s3Service.downloadFileByPath as ReturnType<typeof mock>).mockClear();
    (s3Service.deleteFileByPath as ReturnType<typeof mock>).mockClear();
    (filesRepository.create as ReturnType<typeof mock>).mockClear();
    (filesRepository.save as ReturnType<typeof mock>).mockClear();
    (filesRepository.findOne as ReturnType<typeof mock>).mockClear();
    (filesRepository.remove as ReturnType<typeof mock>).mockClear();
    (
      helpersService.isSupportedImageType as ReturnType<typeof mock>
    ).mockClear();
    (helpersService.extractFilename as ReturnType<typeof mock>).mockClear();
    (helpersService.calculateImageSize as ReturnType<typeof mock>).mockClear();
  });

  describe('upload', () => {
    it('should upload new files to S3 and save metadata in DB', async () => {
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
          id: '1',
          path: 'userId/file1.png',
          name: 'file1',
          extension: 'png',
          mimetype: 'image/png',
          userId: 'mockUserId',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
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

      // Mock findOne to return null (no existing files)
      filesRepository.findOne.mockResolvedValue(null);

      // Mock isImageType to return true for images
      helpersService.isSupportedImageType.mockReturnValue(true);

      // Mock calculateImageSize to return width/height for images
      helpersService.calculateImageSize
        .mockReturnValueOnce({ width: 100, height: 200 })
        .mockReturnValueOnce(null); // PDF files don't have image dimensions

      filesRepository.create
        .mockReturnValueOnce({
          ...mockS3Responses[0],
          userId: 'mockUserId',
        })
        .mockReturnValueOnce({
          ...mockS3Responses[1],
          userId: 'mockUserId',
        });

      filesRepository.save
        .mockResolvedValueOnce(mockEntities[0])
        .mockResolvedValueOnce(mockEntities[1]);

      const result = await service.upload('mockUserId', mockFiles);

      expect(s3Service.upsertFile).toHaveBeenCalledTimes(2);
      expect(s3Service.upsertFile).toHaveBeenCalledWith({
        context: 'files',
        userId: 'mockUserId',
        file: mockFiles[0],
        fileId: expect.any(String),
      });
      expect(s3Service.upsertFile).toHaveBeenCalledWith({
        context: 'files',
        userId: 'mockUserId',
        file: mockFiles[1],
        fileId: expect.any(String),
      });

      expect(filesRepository.findOne).toHaveBeenCalledTimes(2);
      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: {
          extension: 'png',
          name: 'file1',
          userId: 'mockUserId',
          size: undefined,
        },
      });
      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: {
          extension: 'pdf',
          name: 'document',
          userId: 'mockUserId',
          size: undefined,
        },
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
      });

      expect(filesRepository.save).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockEntities);
    });

    it('should update existing files when uploading with same path (upsert)', async () => {
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
      filesRepository.findOne.mockResolvedValue(existingEntity);
      filesRepository.save.mockResolvedValue(updatedEntity);

      // Mock calculateImageSize
      helpersService.calculateImageSize.mockReturnValue({
        width: 100,
        height: 200,
      });

      const result = await service.upload('newUserId', [mockFile]);

      expect(s3Service.upsertFile).toHaveBeenCalledTimes(1);
      expect(s3Service.upsertFile).toHaveBeenCalledWith({
        context: 'files',
        userId: 'newUserId',
        file: mockFile,
        fileId: expect.any(String),
      });

      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: {
          extension: 'png',
          name: 'file1',
          userId: 'newUserId',
          size: undefined,
        },
      });

      expect(filesRepository.create).not.toHaveBeenCalled();

      expect(filesRepository.save).toHaveBeenCalledWith({
        ...existingEntity,
        userId: 'newUserId',
        name: mockS3Response.name,
        extension: mockS3Response.extension,
        mimetype: mockS3Response.mimetype,
        width: 100,
        height: 200,
      });

      expect(result).toEqual([updatedEntity]);
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

      filesRepository.findOne.mockResolvedValue(mockFile);
      s3Service.downloadFileByPath.mockResolvedValue(mockDownload);

      const result = await service.downloadById(fileId);

      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: { id: fileId },
      });
      expect(s3Service.downloadFileByPath).toHaveBeenCalledWith(mockFile.path);
      expect(result).toEqual({
        createdBy: 'userId',
        stream: mockStream,
        contentType: mockDownload.contentType,
        contentLength: mockDownload.contentLength,
        filename: 'file.png',
      });
    });

    it('should download file without contentLength', async () => {
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
        contentLength: undefined,
      };

      filesRepository.findOne.mockResolvedValue(mockFile);
      s3Service.downloadFileByPath.mockResolvedValue(mockDownload);

      const result = await service.downloadById(fileId);

      expect(result).toEqual({
        createdBy: 'userId',
        stream: mockStream,
        contentType: mockDownload.contentType,
        contentLength: undefined,
        filename: 'file.png',
      });
    });

    it('should throw NotFoundException when file not found', async () => {
      const fileId = 'non-existent-id';
      filesRepository.findOne.mockResolvedValue(null);

      await expect(service.downloadById(fileId)).rejects.toThrow(
        'File with ID non-existent-id not found',
      );
      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: { id: fileId },
      });
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

      filesRepository.findOne.mockResolvedValue(mockFile);
      s3Service.deleteFileByPath.mockResolvedValue(undefined);
      filesRepository.remove.mockResolvedValue(mockFile);

      await service.deleteById(fileId, {
        id: 'userId',
        roles: [UserRole.ADMIN],
      });

      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: { id: fileId },
      });
      expect(s3Service.deleteFileByPath).toHaveBeenCalledWith(mockFile.path);
      expect(filesRepository.remove).toHaveBeenCalledWith(mockFile);
    });

    it('should throw NotFoundException when file not found', async () => {
      const fileId = 'non-existent-id';
      filesRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteById(fileId, {
          id: 'userId',
          roles: [UserRole.ADMIN],
        }),
      ).rejects.toThrow('File with ID non-existent-id not found');
      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: { id: fileId },
      });
      expect(s3Service.deleteFileByPath).not.toHaveBeenCalled();
      expect(filesRepository.remove).not.toHaveBeenCalled();
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
      const mockStream = createMockStream('file content');
      const mockDownload = {
        stream: mockStream,
        contentType: 'application/pdf',
        contentLength: 5678,
      };

      filesRepository.findOne.mockResolvedValue(mockFile);
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
      const mockStream = createMockStream('file content');
      const mockDownload = {
        stream: mockStream,
        contentType: 'text/plain',
        contentLength: 100,
      };

      filesRepository.findOne.mockResolvedValue(mockFile);
      s3Service.downloadFileByPath.mockResolvedValue(mockDownload);

      const result = await service.downloadById(fileId);

      expect(result.filename).toBe('README');
    });
  });
});
