import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FILES } from '../../config/constants';
import { ValidatedFile, validatedFilePipe, ValidatedFiles } from './validated-files.decorator';

describe('ValidatedFiles Decorator Integration Tests', () => {
  // Mock file factories
  const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'testfile.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024 * 5, // 5KB
    buffer: Buffer.from('test content'),
    stream: {} as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  });

  const createLargeFile = (size: number): Express.Multer.File =>
    createMockFile({
      originalname: 'largefile.pdf',
      size,
      buffer: Buffer.alloc(size),
    });

  const createSmallFile = (size: number): Express.Multer.File =>
    createMockFile({
      originalname: 'smallfile.pdf',
      size,
      buffer: Buffer.alloc(size),
    });

  const createUnsupportedFile = (): Express.Multer.File =>
    createMockFile({
      originalname: 'testfile.xyz',
      mimetype: 'application/unsupported',
    });

  describe('validatedFilePipe function', () => {
    describe('File type validation', () => {
      test('should accept supported file types (string mimetype)', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const file = createMockFile({ mimetype: 'application/pdf' });

        // Act & Assert - should not throw
        const result = await pipe.transform(file);
        assert.strictEqual(result, file);
      });

      test('should accept supported file types (regex mimetype)', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: /^(application\/pdf|text\/plain)$/,
        });
        const pdfFile = createMockFile({ mimetype: 'application/pdf' });
        const txtFile = createMockFile({
          mimetype: 'text/plain',
          originalname: 'testfile.txt',
        });

        // Act & Assert - should not throw
        const pdfResult = await pipe.transform(pdfFile);
        const txtResult = await pipe.transform(txtFile);

        assert.strictEqual(pdfResult, pdfFile);
        assert.strictEqual(txtResult, txtFile);
      });

      test('should reject unsupported file types', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const unsupportedFile = createUnsupportedFile();

        // Act & Assert
        await assert.rejects(() => pipe.transform(unsupportedFile), BadRequestException);
      });

      test('should reject files that do not match regex pattern', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: /^(application\/pdf|text\/plain)$/,
        });
        const unsupportedFile = createMockFile({
          mimetype: 'image/jpeg',
          originalname: 'testfile.jpg',
        });

        // Act & Assert
        await assert.rejects(() => pipe.transform(unsupportedFile), BadRequestException);
      });
    });

    describe('File size validation', () => {
      test('should accept files within default size limits', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const validFile = createMockFile({
          size: FILES.MIN_SIZE + 1000, // Just above minimum
        });

        // Act & Assert - should not throw
        const result = await pipe.transform(validFile);
        assert.strictEqual(result, validFile);
      });

      test('should accept files within custom size limits', async () => {
        // Arrange
        const minSize = 2048;
        const maxSize = 1024 * 1024; // 1MB
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minSize,
          maxSize,
        });
        const validFile = createMockFile({ size: minSize + 1000 });

        // Act & Assert - should not throw
        const result = await pipe.transform(validFile);
        assert.strictEqual(result, validFile);
      });

      test('should reject files below minimum size', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const tooSmallFile = createSmallFile(FILES.MIN_SIZE - 1);

        // Act & Assert
        await assert.rejects(() => pipe.transform(tooSmallFile), BadRequestException);
      });

      test('should reject files above maximum size', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const tooLargeFile = createLargeFile(FILES.MAX_SIZE + 1);

        // Act & Assert
        await assert.rejects(() => pipe.transform(tooLargeFile), BadRequestException);
      });

      test('should reject files below custom minimum size', async () => {
        // Arrange
        const minSize = 4096;
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minSize,
        });
        const tooSmallFile = createSmallFile(minSize - 1);

        // Act & Assert
        await assert.rejects(() => pipe.transform(tooSmallFile), BadRequestException);
      });

      test('should reject files above custom maximum size', async () => {
        // Arrange
        const maxSize = 1024 * 1024; // 1MB
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          maxSize,
        });
        const tooLargeFile = createLargeFile(maxSize + 1);

        // Act & Assert
        await assert.rejects(() => pipe.transform(tooLargeFile), BadRequestException);
      });

      test('should handle files exactly at size boundaries', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const minSizeFile = createMockFile({ size: FILES.MIN_SIZE });
        const maxSizeFile = createMockFile({ size: FILES.MAX_SIZE - 1 }); // Just under max

        // Act & Assert - should not throw
        const minResult = await pipe.transform(minSizeFile);
        const maxResult = await pipe.transform(maxSizeFile);

        assert.strictEqual(minResult, minSizeFile);
        assert.strictEqual(maxResult, maxSizeFile);
      });
    });

    describe('Filename length validation', () => {
      test('should accept files with valid filename length (default 6 characters)', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const validFile = createMockFile({
          originalname: 'validname.pdf', // 9 characters without extension
        });

        // Act & Assert - should not throw
        const result = await pipe.transform(validFile);
        assert.strictEqual(result, validFile);
      });

      test('should accept files with exactly minimum filename length', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const validFile = createMockFile({
          originalname: 'sixchr.pdf', // exactly 6 characters without extension
        });

        // Act & Assert - should not throw
        const result = await pipe.transform(validFile);
        assert.strictEqual(result, validFile);
      });

      test('should reject files with filename below minimum length', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const invalidFile = createMockFile({
          originalname: 'short.pdf', // 5 characters without extension
        });

        // Act & Assert
        await assert.rejects(() => pipe.transform(invalidFile), BadRequestException);
      });

      test('should accept files with custom minimum filename length', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minFileNameLength: 10,
        });
        const validFile = createMockFile({
          originalname: 'tencharfilename.pdf', // 15 characters without extension
        });

        // Act & Assert - should not throw
        const result = await pipe.transform(validFile);
        assert.strictEqual(result, validFile);
      });

      test('should reject files below custom minimum filename length', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minFileNameLength: 10,
        });
        const invalidFile = createMockFile({
          originalname: 'shortname.pdf', // 9 characters without extension
        });

        // Act & Assert
        await assert.rejects(() => pipe.transform(invalidFile), BadRequestException);
      });

      test('should handle files without extension correctly', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const validFile = createMockFile({
          originalname: 'validfilename', // 13 characters, no extension
          mimetype: 'application/pdf',
        });

        // Act & Assert - should not throw
        const result = await pipe.transform(validFile);
        assert.strictEqual(result, validFile);
      });

      test('should validate filename length for multiple files', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const files = [
          createMockFile({ originalname: 'validname1.pdf' }),
          createMockFile({ originalname: 'validname2.pdf' }),
        ];

        // Act & Assert - should not throw
        const result = await pipe.transform(files);
        assert.strictEqual(result, files);
      });

      test('should reject multiple files if any filename is too short', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const files = [
          createMockFile({ originalname: 'validname.pdf' }),
          createMockFile({ originalname: 'short.pdf' }), // 5 characters - too short
        ];

        // Act & Assert
        await assert.rejects(() => pipe.transform(files), BadRequestException);
      });

      test('should provide meaningful error message for filename validation', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const invalidFile = createMockFile({
          originalname: 'abc.pdf', // 3 characters without extension
        });

        // Act & Assert
        try {
          await pipe.transform(invalidFile);
          assert.fail('Expected validation to throw');
        } catch (error) {
          assert.ok(error instanceof BadRequestException);
          assert.ok(
            (error as BadRequestException).message.includes(
              'File name "abc" must be at least 6 characters long'
            )
          );
        }
      });
    });

    describe('Combined validation scenarios', () => {
      test('should validate both file type and size together', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: /^(application\/pdf|text\/plain)$/,
          minSize: 2048,
          maxSize: 1024 * 1024,
        });
        const validFile = createMockFile({
          mimetype: 'application/pdf',
          size: 4096,
        });

        // Act & Assert - should not throw
        const result = await pipe.transform(validFile);
        assert.strictEqual(result, validFile);
      });

      test('should reject file with valid type but invalid size', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minSize: 2048,
        });
        const invalidFile = createMockFile({
          mimetype: 'application/pdf',
          size: 1024, // Below minimum
        });

        // Act & Assert
        await assert.rejects(() => pipe.transform(invalidFile), BadRequestException);
      });

      test('should reject file with valid size but invalid type', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const invalidFile = createMockFile({
          mimetype: 'image/jpeg',
          size: FILES.MIN_SIZE + 1000,
        });

        // Act & Assert
        await assert.rejects(() => pipe.transform(invalidFile), BadRequestException);
      });
    });

    describe('Edge cases and null handling', () => {
      test('should handle null/undefined files gracefully', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });

        // Act & Assert
        await assert.rejects(() => pipe.transform(null as never));

        await assert.rejects(() => pipe.transform(undefined as never));
      });

      test('should handle files with missing properties', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const incompleteFile = {
          originalname: 'test.pdf',
          // Missing mimetype and size
        } as Express.Multer.File;

        // Act & Assert
        await assert.rejects(() => pipe.transform(incompleteFile));
      });
    });

    describe('Error message verification', () => {
      test('should provide meaningful error messages for file type validation', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const unsupportedFile = createUnsupportedFile();

        // Act & Assert
        try {
          await pipe.transform(unsupportedFile);
          assert.fail('Expected validation to throw');
        } catch (error) {
          assert.ok(error instanceof BadRequestException);
          assert.ok((error as BadRequestException).message.includes('Validation failed'));
        }
      });

      test('should provide meaningful error messages for file size validation', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const tooSmallFile = createSmallFile(FILES.MIN_SIZE - 1);

        // Act & Assert
        try {
          await pipe.transform(tooSmallFile);
          assert.fail('Expected validation to throw');
        } catch (error) {
          assert.ok(error instanceof BadRequestException);
          assert.ok((error as BadRequestException).message.includes('must not be empty'));
          assert.ok(
            (error as BadRequestException).message.includes(`minimum size: ${FILES.MIN_SIZE} bytes`)
          );
          assert.ok((error as BadRequestException).message.includes('smallfile.pdf'));
        }
      });
    });

    describe('Multiple files validation', () => {
      test('should validate multiple valid files', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const files = [
          createMockFile({ originalname: 'filename1.pdf' }),
          createMockFile({ originalname: 'filename2.pdf' }),
        ];

        // Act & Assert - should not throw
        const result = await pipe.transform(files);
        assert.strictEqual(result, files);
      });

      test('should reject if any file is invalid', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const files = [createMockFile({ originalname: 'filename1.pdf' }), createUnsupportedFile()];

        // Act & Assert
        await assert.rejects(() => pipe.transform(files), BadRequestException);
      });

      test('should validate all files meet size requirements', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minSize: 2048,
        });
        const files = [createMockFile({ size: 2048 }), createMockFile({ size: 4096 })];

        // Act & Assert - should not throw
        const result = await pipe.transform(files);
        assert.strictEqual(result, files);
      });

      test('should reject if any file fails size validation', async () => {
        // Arrange
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minSize: 2048,
        });
        const files = [
          createMockFile({ size: 4096 }),
          createSmallFile(1024), // Below minimum
        ];

        // Act & Assert
        await assert.rejects(() => pipe.transform(files), BadRequestException);
      });
    });

    describe('Configuration defaults', () => {
      test('should use FILES constants as defaults', async () => {
        // Arrange
        const pipe = validatedFilePipe({ fileType: 'application/pdf' });
        const borderlineFile = createMockFile({ size: FILES.MIN_SIZE });

        // Act & Assert - should not throw (exactly at minimum)
        const result = await pipe.transform(borderlineFile);
        assert.strictEqual(result, borderlineFile);

        // Should reject below minimum
        const tooSmallFile = createSmallFile(FILES.MIN_SIZE - 1);
        await assert.rejects(() => pipe.transform(tooSmallFile), BadRequestException);
      });

      test('should handle falsy values for size options correctly', async () => {
        // Arrange - zero should default to FILES constants
        const pipe = validatedFilePipe({
          fileType: 'application/pdf',
          minSize: 0, // Should default to FILES.MIN_SIZE
          maxSize: 0, // Should default to FILES.MAX_SIZE
        });
        const file = createMockFile({ size: FILES.MIN_SIZE });

        // Act & Assert - should work with defaults
        const result = await pipe.transform(file);
        assert.strictEqual(result, file);
      });
    });
  });

  describe('Decorator functions', () => {
    test('should create ValidatedFile decorator', () => {
      // Act
      const decorator = ValidatedFile({ fileType: 'application/pdf' });

      // Assert
      assert.ok(decorator !== undefined);
      assert.strictEqual(typeof decorator, 'function');
    });

    test('should create ValidatedFiles decorator', () => {
      // Act
      const decorator = ValidatedFiles({ fileType: 'application/pdf' });

      // Assert
      assert.ok(decorator !== undefined);
      assert.strictEqual(typeof decorator, 'function');
    });
  });

  describe('Real-world file scenarios', () => {
    test('should handle common PDF files', async () => {
      // Arrange
      const pipe = validatedFilePipe({
        fileType: /^application\/pdf$/,
      });
      const pdfFile = createMockFile({
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: 2 * 1024 * 1024, // 2MB
      });

      // Act & Assert
      const result = await pipe.transform(pdfFile);
      assert.strictEqual(result, pdfFile);
    });

    test('should handle common document formats', async () => {
      // Arrange
      const pipe = validatedFilePipe({
        fileType: /^(application\/pdf|application\/msword|text\/plain)$/,
      });

      const files = [
        createMockFile({
          mimetype: 'application/pdf',
          originalname: 'document.pdf',
        }),
        createMockFile({
          mimetype: 'application/msword',
          originalname: 'document.doc',
        }),
        createMockFile({
          mimetype: 'text/plain',
          originalname: 'document.txt',
        }),
      ];

      // Act & Assert
      for (const file of files) {
        const result = await pipe.transform(file);
        assert.strictEqual(result, file);
      }
    });

    test('should reject common image formats when expecting documents', async () => {
      // Arrange
      const pipe = validatedFilePipe({
        fileType: /^(application\/pdf|text\/plain)$/,
      });

      const imageFiles = [
        createMockFile({
          mimetype: 'image/jpeg',
          originalname: 'photofile.jpg',
        }),
        createMockFile({
          mimetype: 'image/png',
          originalname: 'imagefile.png',
        }),
        createMockFile({
          mimetype: 'image/gif',
          originalname: 'animation.gif',
        }),
      ];

      // Act & Assert
      for (const file of imageFiles) {
        await assert.rejects(() => pipe.transform(file), BadRequestException);
      }
    });

    test('should handle typical business document size limits', async () => {
      // Arrange - typical business limits
      const pipe = validatedFilePipe({
        fileType: 'application/pdf',
        minSize: 1024, // 1KB minimum
        maxSize: 50 * 1024 * 1024, // 50MB maximum
      });

      const businessDoc = createMockFile({
        originalname: 'annual-report.pdf',
        size: 25 * 1024 * 1024, // 25MB
      });

      // Act & Assert
      const result = await pipe.transform(businessDoc);
      assert.strictEqual(result, businessDoc);
    });
  });
});
