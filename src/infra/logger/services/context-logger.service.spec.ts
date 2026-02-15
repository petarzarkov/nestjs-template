import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  mock,
  spyOn,
} from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { AppEnv } from '@/config/enum/app-env.enum';
import { AppConfigService } from '@/config/services/app.config.service';
import { HelpersModule } from '@/core/helpers/helpers.module';
import { LogLevel } from '../log-level.enum';
import { ContextService } from './context.service';
import { ContextLogger } from './context-logger.service';

// Helper function to clean ANSI color codes and parse JSON
function parseLogOutput(logCall: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: test code
  const cleanLog = logCall.replace(/\u001b\[[0-9;]*m/g, '');
  return JSON.parse(cleanLog);
}

describe('ContextLogger', () => {
  let logger: ContextLogger;
  let configService: Partial<
    AppConfigService<{
      app: Record<string, unknown>;
      log: Record<string, unknown>;
    }>
  >;
  let contextService: Partial<ContextService>;
  let consoleLogSpy: ReturnType<typeof spyOn>;

  const mockConfig = {
    app: {
      name: 'test-app',
      version: '1.0.0',
      env: AppEnv.LOCAL,
      nodeEnv: 'development' as const,
      port: 3000,
      basicAuthToken: undefined,
      webAppUrl: 'http://localhost:3000',
      corsOrigin: 'http://localhost:3000',
    },
    log: {
      level: LogLevel.DEBUG,
      maskFields: ['password', 'token', 'apiKey', 'apiSecret', 'apiPass'],
      filterEvents: ['/health'],
      maxArrayLength: 1,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HelpersModule],
      providers: [
        ContextLogger,
        {
          provide: AppConfigService,
          useValue: {
            getOrThrow: mock((key: string) => {
              if (key === 'app') return mockConfig.app;
              if (key === 'log') return mockConfig.log;
              return undefined;
            }),
          },
        },
        {
          provide: ContextService,
          useValue: {
            getContext: mock(() => ({
              requestId: 'test-request-id',
              userId: 'test-user-id',
              event: '/test',
            })),
          },
        },
      ],
    }).compile();

    logger = module.get<ContextLogger>(ContextLogger);
    configService = module.get(AppConfigService);
    contextService = module.get(ContextService);

    // Mock console.log to capture output
    consoleLogSpy = spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    // Restore the spy to clear mock calls between tests
    consoleLogSpy.mockRestore();
  });

  describe('basic logging', () => {
    it('should log info messages with nested objects', () => {
      const nestedObject = { some: { nested: 'value' } };

      logger.log('Test', nestedObject);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.message).toBe('Test');
      expect(logData.some).toEqual({ nested: 'value' });
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('debug');
      expect(logData.message).toBe('Debug message');
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('warn');
      expect(logData.message).toBe('Warning message');
    });

    it('should log verbose messages', async () => {
      // Configure logger to allow verbose level
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app') return mockConfig.app;
        if (key === 'log')
          return { ...mockConfig.log, level: LogLevel.VERBOSE };
        return undefined;
      });

      // Recreate logger with new config
      const module: TestingModule = await Test.createTestingModule({
        imports: [HelpersModule],
        providers: [
          ContextLogger,
          {
            provide: AppConfigService,
            useValue: configService,
          },
          {
            provide: ContextService,
            useValue: contextService,
          },
        ],
      }).compile();

      const verboseLogger = module.get<ContextLogger>(ContextLogger);
      spyOn(console, 'log').mockImplementation();

      verboseLogger.verbose('Verbose message');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('verbose');
      expect(logData.message).toBe('Verbose message');
    });
  });

  describe('error logging', () => {
    it('should log error messages with Error objects', () => {
      const error = new Error('Test error message');

      logger.error('Error occurred', error);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Error occurred');
      expect(logData.error.message).toBe('Test error message');
      expect(logData.error.stack).toBeDefined();
    });

    it('should log fatal messages with Error objects', () => {
      const error = new Error('Fatal error');

      logger.fatal('Fatal error occurred', error);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('fatal');
      expect(logData.message).toBe('Fatal error occurred');
      expect(logData.error.message).toBe('Fatal error');
    });

    it('should handle error objects in different positions', () => {
      const error = new Error('Position test');
      const extraData = { userId: '123' };

      logger.error('Error with extra data', extraData, error);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.error.message).toBe('Position test');
      expect(logData.userId).toBe('123');
    });

    it('should handle error objects with err property', () => {
      const error = new Error('Nested error');
      const errorWrapper = { err: error };

      logger.error('Nested error', errorWrapper);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.error.message).toBe('Nested error');
    });

    it('should handle { error: string } shorthand at error level', () => {
      const error = 'Request failed with status 500';
      logger.error('Some error', { error });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Some error');
      expect(logData.error.message).toBe('Request failed with status 500');
      expect(logData.error.name).toBe('Error');
      expect(logData.error.stack).toBeDefined();
    });

    it('should handle { error: string } with additional properties at error level', () => {
      logger.error('Some error', { error: 'Request failed', statusCode: 500 });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Some error');
      expect(logData.error.message).toBe('Request failed');
      expect(logData.statusCode).toBe(500);
    });

    it('should handle string error messages', () => {
      logger.error('String error', 'This is a string error');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.error.message).toBe('This is a string error');
    });
  });

  describe('context and metadata', () => {
    it('should include context information', () => {
      logger.log('Test with context');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.requestId).toBe('test-request-id');
      expect(logData.userId).toBe('test-user-id');
      expect(logData.event).toBe('/test');
    });

    it('should include app metadata', () => {
      logger.log('Test app metadata');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.appId).toBe('test-app-1.0.0-local');
      expect(logData.timestamp).toBeDefined();
    });
  });

  describe('data sanitization', () => {
    it('should mask sensitive fields', () => {
      const sensitiveData = {
        password: 'secret123',
        token: 'jwt-token',
        normalField: 'visible',
      };

      logger.log('Sensitive data test', sensitiveData);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.password).toBe('[MASKED]');
      expect(logData.token).toBe('[MASKED]');
      expect(logData.normalField).toBe('visible');
    });

    it('should mask nested sensitive fields', () => {
      const nestedSensitiveData = {
        user: {
          password: 'secret123',
          profile: {
            token: 'jwt-token',
          },
        },
        public: 'visible',
      };

      logger.log('Nested sensitive data', nestedSensitiveData);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.user.password).toBe('[MASKED]');
      expect(logData.user.profile.token).toBe('[MASKED]');
      expect(logData.public).toBe('visible');
    });

    it('should mask sensitive fields in arrays', () => {
      const responseBody = [
        {
          id: 'c0d92e74-1328-4f3c-9c2e-28e989bcfb08',
          entityId: null,
          apiKey: '2ea996bc-1a44-41aa-8d61-411e4f26d3c0',
          apiSecret: 'EFE4CCC813C3A909C320BEA2082B8DC2',
          apiPass: 'Supercoolpass123!',
          provider: 'okx',
        },
      ];

      logger.log('Sent Response', { responseBody });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.responseBody).toHaveLength(1);
      expect(logData.responseBody[0].id).toBe(
        'c0d92e74-1328-4f3c-9c2e-28e989bcfb08',
      );
      expect(logData.responseBody[0].provider).toBe('okx');
      expect(logData.responseBody[0].apiKey).toBe('[MASKED]');
      expect(logData.responseBody[0].apiSecret).toBe('[MASKED]');
      expect(logData.responseBody[0].apiPass).toBe('[MASKED]');
    });

    it('should mask sensitive fields in nested arrays', async () => {
      // Configure logger with higher maxArrayLength for this test
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app') return mockConfig.app;
        if (key === 'log') return { ...mockConfig.log, maxArrayLength: 5 };
        return undefined;
      });

      // Recreate logger with new config
      const module: TestingModule = await Test.createTestingModule({
        imports: [HelpersModule],
        providers: [
          ContextLogger,
          {
            provide: AppConfigService,
            useValue: configService,
          },
          {
            provide: ContextService,
            useValue: contextService,
          },
        ],
      }).compile();

      const testLogger = module.get<ContextLogger>(ContextLogger);
      spyOn(console, 'log').mockImplementation();

      const complexData = {
        users: [
          {
            id: 1,
            name: 'John',
            credentials: {
              password: 'secret123',
              apiKey: 'key123',
            },
          },
          {
            id: 2,
            name: 'Jane',
            auth: {
              token: 'jwt-token',
              secret: 'secret456',
            },
          },
        ],
        metadata: {
          apiSecret: 'global-secret',
        },
      };

      testLogger.log('Complex nested data', complexData);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.users).toHaveLength(2);
      expect(logData.users[0].name).toBe('John');
      expect(logData.users[0].credentials.password).toBe('[MASKED]');
      expect(logData.users[0].credentials.apiKey).toBe('[MASKED]');
      expect(logData.users[1].name).toBe('Jane');
      expect(logData.users[1].auth.token).toBe('[MASKED]');
      expect(logData.users[1].auth.secret).toBe('[MASKED]');
      expect(logData.metadata.apiSecret).toBe('[MASKED]');
    });
  });

  describe('log level filtering', () => {
    it('should not log when level is below configured level', async () => {
      // Configure logger to only log ERROR and above
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app') return mockConfig.app;
        if (key === 'log') return { ...mockConfig.log, level: LogLevel.ERROR };
        return undefined;
      });

      // Recreate logger with new config
      const module: TestingModule = await Test.createTestingModule({
        imports: [HelpersModule],
        providers: [
          ContextLogger,
          {
            provide: AppConfigService,
            useValue: configService,
          },
          {
            provide: ContextService,
            useValue: contextService,
          },
        ],
      }).compile();

      const filteredLogger = module.get<ContextLogger>(ContextLogger);
      spyOn(console, 'log').mockImplementation();

      filteredLogger.debug('This should not be logged');
      filteredLogger.log('This should not be logged');

      expect(console.log).not.toHaveBeenCalled();

      filteredLogger.error('This should be logged');
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('event filtering', () => {
    it('should filter out specified events', () => {
      contextService.getContext.mockReturnValue({
        requestId: 'test-request-id',
        userId: 'test-user-id',
        event: '/health',
      });

      logger.log('Health check');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log non-filtered events', () => {
      contextService.getContext.mockReturnValue({
        requestId: 'test-request-id',
        userId: 'test-user-id',
        event: '/api/users',
      });

      logger.log('User request');

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('development vs production formatting', () => {
    it('should use colored JSON in development', async () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app') return { ...mockConfig.app, nodeEnv: 'development' };
        if (key === 'log') return mockConfig.log;
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [HelpersModule],
        providers: [
          ContextLogger,
          {
            provide: AppConfigService,
            useValue: configService,
          },
          {
            provide: ContextService,
            useValue: contextService,
          },
        ],
      }).compile();

      const devLogger = module.get<ContextLogger>(ContextLogger);
      spyOn(console, 'log').mockImplementation();

      devLogger.log('Development test');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      // Check if the output contains ANSI color codes
      // biome-ignore lint/suspicious/noControlCharactersInRegex: test code
      expect(logCall).toMatch(/\u001b\[[0-9;]*m/);
    });

    it('should use plain JSON in production', async () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app') return { ...mockConfig.app, nodeEnv: 'production' };
        if (key === 'log') return mockConfig.log;
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [HelpersModule],
        providers: [
          ContextLogger,
          {
            provide: AppConfigService,
            useValue: configService,
          },
          {
            provide: ContextService,
            useValue: contextService,
          },
        ],
      }).compile();

      const prodLogger = module.get<ContextLogger>(ContextLogger);
      spyOn(console, 'log').mockImplementation();

      prodLogger.log('Production test');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      expect(logCall).toMatch(/^\{.*\}$/);
    });
  });

  describe('user scenarios', () => {
    it('should handle logger.info with nested objects', () => {
      const nestedObject = { some: { nested: 'value' } };

      logger.log('Test', nestedObject);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.message).toBe('Test');
      expect(logData.some).toEqual({ nested: 'value' });
    });

    it('should handle logger.error with Error objects', () => {
      const error = new Error('Test error message');

      logger.error('Error occurred', error);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Error occurred');
      expect(logData.error.message).toBe('Test error message');
      expect(logData.error.stack).toBeDefined();
    });

    it('should handle logger.error called with object (Case 2: Normal object)', () => {
      const objectMessage = { error: 'Something went wrong', code: 500 };

      // This is now valid usage (Case 2) - removed @ts-expect-error
      logger.error(objectMessage);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Object logged');
      expect(logData.error).toBe('Something went wrong');
      expect(logData.code).toBe(500);
      // Should not have warning fields for valid usage
      expect(logData.invalidMessageWarning).toBeUndefined();
    });

    it('should handle logger.error called with empty object (Case 2: Normal object)', () => {
      const emptyObject = {};

      // This is now valid usage (Case 2) - removed @ts-expect-error
      logger.error(emptyObject);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Object logged');
      // Should not have warning fields for valid usage
      expect(logData.invalidMessageWarning).toBeUndefined();
    });

    it('should handle logger.error called with null or undefined', () => {
      // @ts-expect-error - Intentionally calling with wrong type to test runtime handling
      logger.error(null);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('[null]');
      expect(logData.invalidMessageWarning).toBe(
        'Logger called with non-string message parameter',
      );
      expect(logData.invalidMessageCallstack).toBeDefined();
      expect(logData.originalMessageType).toBe('object');
      expect(logData.originalMessage).toBe('null');
    });
  });

  describe('All 9 logging cases', () => {
    it('Case 1: log(String)', () => {
      logger.log('Simple string message');

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('log');
      expect(logData.message).toBe('Simple string message');
      expect(logData.error).toBeUndefined();
    });

    it('Case 2: log(NormalObject)', () => {
      const testObject = { userId: '123', action: 'login', success: true };

      logger.log(testObject);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('log');
      expect(logData.message).toBe('Object logged');
      expect(logData.userId).toBe('123');
      expect(logData.action).toBe('login');
      expect(logData.success).toBe(true);
      expect(logData.error).toBeUndefined();
    });

    it('Case 3: log(ErrorInstance)', () => {
      const error = new Error('Test error');

      logger.error(error);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Test error');
      expect(logData.error.message).toBe('Test error');
      expect(logData.error.stack).toBeDefined();
    });

    it('Case 4: log(NormalObject with nested errorInstance)', () => {
      const objectWithError = {
        operation: 'database-query',
        metadata: {
          nested: {
            error: new Error('Connection timeout'),
          },
        },
      };

      logger.error(objectWithError);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Connection timeout');
      expect(logData.error.message).toBe('Connection timeout');
      expect(logData.operation).toBe('database-query');
      expect(logData.metadata).toEqual({
        nested: { error: expect.any(Object) },
      });
    });

    it('Case 5: warn/error/fatal(OnlyString)', () => {
      logger.warn('Warning message');
      logger.error('Error message');
      logger.fatal('Fatal message');

      const calls = (console.log as Mock<() => unknown>).mock.calls;

      const warnData = parseLogOutput(calls[0][0]);
      expect(warnData.level).toBe('warn');
      expect(warnData.message).toBe('Warning message');

      const errorData = parseLogOutput(calls[1][0]);
      expect(errorData.level).toBe('error');
      expect(errorData.message).toBe('Error message');

      const fatalData = parseLogOutput(calls[2][0]);
      expect(fatalData.level).toBe('fatal');
      expect(fatalData.message).toBe('Fatal message');
    });

    it('Case 6: log(String, ErrorInstance)', () => {
      const error = new Error('Database connection failed');

      logger.error('Operation failed', error);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Operation failed');
      expect(logData.error.message).toBe('Database connection failed');
      expect(logData.error.stack).toBeDefined();
    });

    it('Case 7: log(String, { err: ErrorInstance })', () => {
      const error = new Error('API rate limit exceeded');

      logger.error('API call failed', { err: error, retryAfter: 30 });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('API call failed');
      expect(logData.error.message).toBe('API rate limit exceeded');
      expect(logData.retryAfter).toBe(30);
    });

    it('Case 8: log(String, { error: ErrorInstance })', () => {
      const error = new Error('Validation failed');

      logger.error('Request invalid', { error: error, field: 'email' });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Request invalid');
      expect(logData.error.message).toBe('Validation failed');
      expect(logData.field).toBe('email');
    });

    it('Case 9: log(String, AnyNestedErrorInstance)', () => {
      const nestedError = new Error('File not found');
      const complexObject = {
        operation: 'file-upload',
        metadata: {
          size: 1024,
          nested: {
            deeply: {
              hiddenError: nestedError,
            },
          },
        },
      };

      logger.error('Complex operation failed', complexObject);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.level).toBe('error');
      expect(logData.message).toBe('Complex operation failed');
      expect(logData.error.message).toBe('File not found');
      expect(logData.operation).toBe('file-upload');
      expect(logData.metadata.size).toBe(1024);
    });
  });

  describe('JSON-safe sanitization', () => {
    it('should properly serialize Error objects nested in extra data', () => {
      const nestedData = {
        operation: 'db-query',
        details: {
          query: 'SELECT * FROM users',
          dbError: new Error('Connection refused'),
        },
      };

      logger.log('Database operation failed', nestedData);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      // Nested Error should be serialized as { name, message, stack }, not empty {}
      expect(logData.details.dbError).toBeDefined();
      expect(logData.details.dbError.message).toBe('Connection refused');
      expect(logData.details.dbError.name).toBe('Error');
    });

    it('should handle functions safely', () => {
      function testFunction() {
        return 'test';
      }
      const namedFunction = function namedFunc() {
        return 'named';
      };
      const arrowFunction = () => 'arrow';

      logger.log('Function test', {
        regular: testFunction,
        named: namedFunction,
        arrow: arrowFunction,
      });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.regular).toBe('[Function: testFunction]');
      expect(logData.named).toBe('[Function: namedFunc]');
      expect(logData.arrow).toBe('[Function: arrowFunction]');
    });

    it('should handle BigInt values safely', () => {
      const bigIntValue = BigInt(123456789012345);

      logger.log('BigInt test', { value: bigIntValue });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.value).toBe('[BigInt: 123456789012345]');
    });

    it('should handle Symbol values safely', () => {
      const symbolValue = Symbol('test');
      const symbolWithDesc = Symbol.for('globalSymbol');

      logger.log('Symbol test', {
        basic: symbolValue,
        global: symbolWithDesc,
      });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.basic).toMatch(/\[Symbol: Symbol\(test\)\]/);
      expect(logData.global).toMatch(/\[Symbol: Symbol\(globalSymbol\)\]/);
    });

    it('should handle Date objects safely', () => {
      const testDate = new Date('2023-01-01T00:00:00.000Z');

      logger.log('Date test', { date: testDate });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.date).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should handle RegExp objects safely', () => {
      const regex = /test.*pattern/gi;

      logger.log('RegExp test', { pattern: regex });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.pattern).toBe('[RegExp: /test.*pattern/gi]');
    });

    it('should handle mixed problematic types in arrays', () => {
      const testFunction = function testFunc() {
        return 'test';
      };
      const mixedArray = [
        'string',
        123,
        testFunction,
        BigInt(456),
        Symbol('arraySymbol'),
        new Date('2023-01-01'),
        /pattern/i,
      ];

      logger.log('Mixed array test', { mixed: mixedArray });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      // With default maxArrayLength of 1, only the first item should be included
      expect(logData.mixed[0]).toBe('string');
      expect(logData.mixed[1]).toBe('[TRUNCATED: 6 more items]');
    });

    it('should handle objects with non-serializable properties', () => {
      const problematicObject = {
        normal: 'string',
        func: () => 'test',
        nested: {
          bigint: BigInt(789),
          symbol: Symbol('nested'),
          date: new Date('2023-06-15T12:00:00.000Z'),
        },
      };

      logger.log('Problematic object test', problematicObject);

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.normal).toBe('string');
      expect(logData.func).toBe('[Function: func]');
      expect(logData.nested.bigint).toBe('[BigInt: 789]');
      expect(logData.nested.symbol).toMatch(/\[Symbol: Symbol\(nested\)\]/);
      expect(logData.nested.date).toBe('2023-06-15T12:00:00.000Z');
    });

    it('should truncate arrays based on maxArrayLength configuration', async () => {
      // Configure logger with maxArrayLength of 3
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app') return mockConfig.app;
        if (key === 'log') return { ...mockConfig.log, maxArrayLength: 3 };
        return undefined;
      });

      // Recreate logger with new config
      const module: TestingModule = await Test.createTestingModule({
        imports: [HelpersModule],
        providers: [
          ContextLogger,
          {
            provide: AppConfigService,
            useValue: configService,
          },
          {
            provide: ContextService,
            useValue: contextService,
          },
        ],
      }).compile();

      const testLogger = module.get<ContextLogger>(ContextLogger);
      spyOn(console, 'log').mockImplementation();

      const longArray = ['item1', 'item2', 'item3', 'item4', 'item5'];

      testLogger.log('Array truncation test', { array: longArray });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.array).toHaveLength(4); // 3 items + truncation message
      expect(logData.array[0]).toBe('item1');
      expect(logData.array[1]).toBe('item2');
      expect(logData.array[2]).toBe('item3');
      expect(logData.array[3]).toBe('[TRUNCATED: 2 more items]');
    });

    it('should not truncate arrays when length is within maxArrayLength', async () => {
      // Configure logger with maxArrayLength of 5
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'app') return mockConfig.app;
        if (key === 'log') return { ...mockConfig.log, maxArrayLength: 5 };
        return undefined;
      });

      // Recreate logger with new config
      const module: TestingModule = await Test.createTestingModule({
        imports: [HelpersModule],
        providers: [
          ContextLogger,
          {
            provide: AppConfigService,
            useValue: configService,
          },
          {
            provide: ContextService,
            useValue: contextService,
          },
        ],
      }).compile();

      const testLogger = module.get<ContextLogger>(ContextLogger);
      spyOn(console, 'log').mockImplementation();

      const shortArray = ['item1', 'item2', 'item3'];

      testLogger.log('Short array test', { array: shortArray });

      const logCall = (console.log as Mock<() => unknown>).mock.calls[0][0];
      const logData = parseLogOutput(logCall);

      expect(logData.array).toHaveLength(3);
      expect(logData.array[0]).toBe('item1');
      expect(logData.array[1]).toBe('item2');
      expect(logData.array[2]).toBe('item3');
    });
  });
});
