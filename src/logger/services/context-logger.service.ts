import { Injectable, LoggerService } from '@nestjs/common';
import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { AppEnv } from '@/config/enum/app-env.enum';
import { PackageJson } from '@/config/PackageJson';
import { AppConfigService } from '@/config/services/app.config.service';
import { Color } from '../color';
import { LogLevel } from '../log-level.enum';
import { ContextService } from './context.service';

const defaultMaskFields = [
  'token',
  'jwt',
  'password',
  'secret',
  'apiPass',
  'apiKey',
  'apiSecret',
];

type LogEntry = Record<string, unknown> & {
  error?: Error;
};

type ColorFn = (text: string) => string;

const LOG_LEVELS: LogLevel[] = [
  LogLevel.VERBOSE,
  LogLevel.DEBUG,
  LogLevel.LOG,
  LogLevel.WARN,
  LogLevel.ERROR,
  LogLevel.FATAL,
];

@Injectable()
export class ContextLogger implements LoggerService {
  private readonly logConfig: ValidatedServiceConfig['log'];
  private readonly appConfig: ValidatedServiceConfig['app'];
  private readonly logLevel: LogLevel;
  private readonly isDevelopment: boolean;
  private readonly maskFields: string[];
  private readonly maxArrayLength: number;

  constructor(
    private readonly configService: AppConfigService<ValidatedServiceConfig>,
    private readonly contextService: ContextService,
  ) {
    this.appConfig = this.configService.getOrThrow('app');
    this.logConfig = this.configService.getOrThrow('log');
    this.logLevel = this.logConfig.level || LogLevel.DEBUG;
    this.isDevelopment = this.appConfig.nodeEnv !== 'production';
    this.maskFields =
      this.logConfig.maskFields && this.logConfig.maskFields?.length > 0
        ? Array.from(
            new Set([...defaultMaskFields, ...this.logConfig.maskFields]),
          )
        : defaultMaskFields;

    this.maxArrayLength = this.logConfig.maxArrayLength || 1;
  }

  log(message: string, ...optionalParams: unknown[]): void;
  log(message: Record<string, unknown>): void;
  log(message: Error): void;
  log(
    message: string | Record<string, unknown> | Error,
    ...optionalParams: unknown[]
  ): void {
    this.#writeLog(LogLevel.LOG, message, optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void;
  error(message: Record<string, unknown>): void;
  error(message: Error): void;
  error(
    message: string | Record<string, unknown> | Error,
    ...optionalParams: unknown[]
  ): void {
    this.#writeLog(LogLevel.ERROR, message, optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void;
  warn(message: Record<string, unknown>): void;
  warn(message: Error): void;
  warn(
    message: string | Record<string, unknown> | Error,
    ...optionalParams: unknown[]
  ): void {
    this.#writeLog(LogLevel.WARN, message, optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void;
  debug(message: Record<string, unknown>): void;
  debug(message: Error): void;
  debug(
    message: string | Record<string, unknown> | Error,
    ...optionalParams: unknown[]
  ): void {
    this.#writeLog(LogLevel.DEBUG, message, optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void;
  verbose(message: Record<string, unknown>): void;
  verbose(message: Error): void;
  verbose(
    message: string | Record<string, unknown> | Error,
    ...optionalParams: unknown[]
  ): void {
    this.#writeLog(LogLevel.VERBOSE, message, optionalParams);
  }

  fatal(message: string, ...optionalParams: unknown[]): void;
  fatal(message: Record<string, unknown>): void;
  fatal(message: Error): void;
  fatal(
    message: string | Record<string, unknown> | Error,
    ...optionalParams: unknown[]
  ): void {
    this.#writeLog(LogLevel.FATAL, message, optionalParams);
  }

  #writeLog(
    level: LogLevel,
    message: string | Record<string, unknown> | Error,
    optionalParams: unknown[],
  ): void {
    if (!this.#shouldLog(level)) {
      return;
    }

    const { preparedMessage, invalidMessageInfo, messageError, messageExtra } =
      this.#prepareMessage(message);
    const { error, extra } = this.#extractErrorAndExtra(optionalParams, level);

    const finalError = messageError || error;
    const finalExtra = { ...messageExtra, ...extra };

    const logEntry = this.#createLogEntry(
      level,
      preparedMessage,
      finalExtra,
      finalError,
      invalidMessageInfo,
    );

    const sanitizedLogEntry = this.#sanitizeLogEntry(logEntry);

    const output = this.isDevelopment
      ? this.#formatColoredJson(sanitizedLogEntry, level)
      : this.#safeStringify(sanitizedLogEntry);

    console.log(output);
  }

  #prepareMessage(
    message: string | Record<string, unknown> | Error | unknown,
  ): {
    preparedMessage: string;
    invalidMessageInfo?: LogEntry;
    messageError?: Error;
    messageExtra?: LogEntry;
  } {
    if (typeof message === 'string') {
      return { preparedMessage: message };
    }

    if (message instanceof Error) {
      return {
        preparedMessage: message.message,
        messageError: message,
      };
    }

    if (this.#isPlainObject(message)) {
      const foundError = this.#findNestedError(message);
      if (foundError) {
        return {
          preparedMessage: foundError.message,
          messageError: foundError,
          messageExtra: message,
        };
      } else {
        return {
          preparedMessage: 'Object logged',
          messageExtra: message,
        };
      }
    }
    const stack = new Error().stack?.split('\n').slice(2, 7).join('\n');
    const preparedMessage =
      message === null || message === undefined
        ? `[${String(message)}]`
        : `[OBJECT]: ${this.#safeStringify(message as LogEntry)}`;

    const invalidMessageInfo = {
      invalidMessageWarning: 'Logger called with non-string message parameter',
      invalidMessageCallstack: stack,
      originalMessageType: typeof message,
      originalMessage: this.#safeStringify(message as LogEntry),
    };

    return { preparedMessage, invalidMessageInfo };
  }

  #extractErrorAndExtra(
    params: unknown[],
    level: LogLevel,
  ): {
    error: Error | null;
    extra: LogEntry;
  } {
    let error: Error | null = null;
    const extra: LogEntry = {};

    for (const param of params) {
      if (param instanceof Error) {
        error = param;
      } else if (typeof param === 'string') {
        const isErrorLevel =
          level === LogLevel.WARN ||
          level === LogLevel.ERROR ||
          level === LogLevel.FATAL;
        if (isErrorLevel) {
          error = new Error(param);
        } else {
          extra.context = param;
        }
      } else if (this.#isPlainObject(param)) {
        if (param.err instanceof Error) {
          error = param.err;

          const { err: _, ...rest } = param;
          Object.assign(extra, rest);
        } else if (param.error instanceof Error) {
          error = param.error;

          const { error: _, ...rest } = param;
          Object.assign(extra, rest);
        } else {
          const foundError = this.#findNestedError(param);
          if (foundError) {
            error = foundError;
          }
          Object.assign(extra, param);
        }
      }
    }
    return { error, extra };
  }

  #createLogEntry(
    level: LogLevel,
    message: string,
    extra: LogEntry,
    error?: Error | null,
    invalidMessageInfo?: LogEntry,
  ): LogEntry {
    const context = this.contextService.getContext();

    const logEntry: LogEntry = {
      level,
      pid: process.pid,
      tz: this.appConfig.timezone,
      timestamp: new Date().toISOString(),
      message,
      appId: `${this.appConfig.name}-${this.appConfig.version}-${this.appConfig.env}`,
      ...context,
      ...extra,
      ...(invalidMessageInfo || {}),
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack?.replace(/\n(\s+)?/g, ','),
      };
    }

    return logEntry;
  }

  #sanitizeLogEntry(obj: LogEntry, visited = new WeakSet()): LogEntry {
    if (visited.has(obj)) {
      return { '[Circular]': 'circular reference detected' };
    }
    visited.add(obj);

    const cleaned: LogEntry = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) {
        continue;
      }

      const shouldMask = this.maskFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase()),
      );

      if (shouldMask) {
        cleaned[key] = '[MASKED]';
      } else {
        const safeValue = this.#makeSafeForJson(value);
        if (safeValue !== undefined) {
          if (Array.isArray(safeValue)) {
            cleaned[key] = this.#sanitizeArray(safeValue, visited);
          } else if (this.#isPlainObject(safeValue)) {
            cleaned[key] = this.#sanitizeLogEntry(safeValue, visited);
          } else {
            cleaned[key] = safeValue;
          }
        }
      }
    }
    return cleaned;
  }

  #sanitizeArray(array: unknown[], visited: WeakSet<object>): unknown[] {
    return array.map(item => {
      if (this.#isPlainObject(item)) {
        return this.#sanitizeLogEntry(item, visited);
      } else if (Array.isArray(item)) {
        return this.#sanitizeArray(item, visited);
      } else {
        return this.#makeSafeForJson(item);
      }
    });
  }

  #formatColoredJson(obj: LogEntry, level: LogLevel): string {
    const jsonString = this.#safeStringify(obj);
    const levelColor = this.#getLevelColor(level);

    const colorMap: Record<string, ColorFn> = {
      level: levelColor,
      message: Color.green,
      timestamp: Color.magenta,
      requestId: Color.brightGreen,
      userId: Color.brightBlue,
      context: Color.brightCyan,
      duration: Color.yellow,
      event: Color.brightMagenta,
      error: Color.red,
      exception: Color.red,
      flow: Color.brightGreen,
    };

    return jsonString.replace(
      /(".*?":\s*)(.*?)(?=,|\n|$)/g,
      (_, key, value) => {
        const keyWithoutQuotes = key.replace(/"/g, '').slice(0, -1);
        const colorizer =
          colorMap[keyWithoutQuotes] || this.#getValueColor(value);
        return `${Color.cyan(key)}${colorizer(value)}`;
      },
    );
  }

  #getValueColor(value: string): ColorFn {
    if (value === 'true' || value === 'false' || !Number.isNaN(Number(value))) {
      return Color.yellow;
    }
    if (value === 'null') {
      return Color.gray;
    }
    return Color.white;
  }

  #getLevelColor(level: LogLevel): ColorFn {
    const levelColorMap: Record<LogLevel, ColorFn> = {
      [LogLevel.FATAL]: Color.bgRedWhite,
      [LogLevel.ERROR]: Color.red,
      [LogLevel.WARN]: Color.yellow,
      [LogLevel.LOG]: Color.bgGreenBlack,
      [LogLevel.DEBUG]: Color.blue,
      [LogLevel.VERBOSE]: Color.gray,
    };
    return levelColorMap[level] || Color.white;
  }

  #shouldLog(level: LogLevel): boolean {
    const configuredIdx = LOG_LEVELS.indexOf(this.logLevel);
    const messageIdx = LOG_LEVELS.indexOf(level);
    if (messageIdx < configuredIdx) {
      return false;
    }

    const context = this.contextService.getContext();
    if (context.event) {
      const filterEvents = this.logConfig.filterEvents || [
        '/api/service/up',
        '/api/service/health',
      ];
      if (filterEvents.includes(context.event)) {
        return false;
      }
    }

    return true;
  }

  #safeStringify(obj: LogEntry): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  #isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      !Array.isArray(obj) &&
      !(obj instanceof Error)
    );
  }

  #findNestedError(
    obj: Record<string, unknown>,
    visited = new WeakSet(),
  ): Error | null {
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    if (visited.has(obj)) {
      return null;
    }
    visited.add(obj);

    for (const value of Object.values(obj)) {
      if (value instanceof Error) {
        return value;
      }
      if (this.#isPlainObject(value)) {
        const nestedError = this.#findNestedError(value, visited);
        if (nestedError) {
          return nestedError;
        }
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof Error) {
            return item;
          }
          if (this.#isPlainObject(item)) {
            const nestedError = this.#findNestedError(item, visited);
            if (nestedError) {
              return nestedError;
            }
          }
        }
      }
    }
    return null;
  }

  #makeSafeForJson(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    const valueType = typeof value;

    if (valueType === 'function') {
      return `[Function: ${(value as { name?: string }).name || 'anonymous'}]`;
    }

    if (valueType === 'symbol') {
      return `[Symbol: ${value.toString()}]`;
    }

    if (valueType === 'bigint') {
      return `[BigInt: ${value.toString()}]`;
    }

    if (valueType !== 'object') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof RegExp) {
      return `[RegExp: ${value.toString()}]`;
    }

    if (value instanceof Error) {
      return value;
    }

    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      const entries: Record<string, unknown> = {};
      try {
        for (const [key, val] of value.entries()) {
          // Duck-type check for File-like objects (works in both Node and Bun)
          if (
            val &&
            typeof val === 'object' &&
            'name' in val &&
            'size' in val &&
            'type' in val
          ) {
            const file = val as { name: string; size: number; type: string };
            entries[key] =
              `[File: ${file.name} (${file.size} bytes, ${file.type})]`;
          } else {
            entries[key] = val;
          }
        }
        return { '[FormData]': entries };
      } catch {
        return '[FormData: unable to read entries]';
      }
    }

    // Duck-type check for File-like objects (works in both Node and Bun)
    if (
      value &&
      typeof value === 'object' &&
      'name' in value &&
      'size' in value &&
      'type' in value &&
      typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    ) {
      const file = value as { name: string; size: number; type: string };
      return `[File: ${file.name} (${file.size} bytes, ${file.type})]`;
    }

    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return `[Blob: ${value.size} bytes, ${value.type}]`;
    }

    if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
      return `[HTMLElement: ${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ''}${value.className ? `.${value.className.split(' ').join('.')}` : ''}]`;
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${value.byteLength} bytes]`;
    }

    if (Array.isArray(value)) {
      return this.#sliceArray(value);
    }

    if (this.#isPlainObject(value)) {
      return value;
    }

    try {
      JSON.stringify(value);
      return value;
    } catch {
      if (value.constructor?.name) {
        return `[${value.constructor.name}: object not serializable]`;
      }
      return '[Object: not serializable]';
    }
  }

  #sliceArray<T>(array: T[]): unknown[] {
    if (array.length <= this.maxArrayLength) {
      return array.map(item => this.#makeSafeForJson(item));
    }

    const slicedArray = array
      .slice(0, this.maxArrayLength)
      .map(item => this.#makeSafeForJson(item));

    return [
      ...slicedArray,
      `[TRUNCATED: ${array.length - this.maxArrayLength} more items]`,
    ];
  }
}

export const bootstrapLogger = (pkg: PackageJson) => {
  return new ContextLogger(
    {
      getOrThrow: (key: keyof ValidatedServiceConfig) => {
        if (key === 'app') {
          return {
            name: pkg.name,
            version: pkg.version,
            nodeEnv: process.env.NODE_ENV || 'development',
            env: process.env.APP_ENV || AppEnv.LOCAL,
          };
        }
        if (key === 'log') {
          return {
            level: LogLevel.DEBUG,
          };
        }

        throw new Error(`Key ${key} not bootstraped`);
      },
    } as unknown as AppConfigService<ValidatedServiceConfig>,
    new ContextService(),
  );
};
