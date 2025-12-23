import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { Controller, Get, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('service')
@Controller('service')
export class HealthController implements OnModuleInit {
  private appConfig: ValidatedServiceConfig['app'];
  private serviceConfig: ValidatedServiceConfig['service'];
  private checks: HealthIndicatorFunction[] = [];

  constructor(
    private configService: AppConfigService<ValidatedConfig>,
    private moduleRef: ModuleRef,
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private logger: ContextLogger,
  ) {
    this.appConfig = this.configService.getOrThrow('app');
    this.serviceConfig = this.configService.getOrThrow('service');
  }

  onModuleInit() {
    const keys = ['db'] as const;
    for (const key of keys) {
      const dbConfig = this.configService.get(key);
      if (!dbConfig) continue;

      const connectionName = key === 'db' ? 'default' : key;

      try {
        const ds = this.moduleRef.get<DataSource>(
          getDataSourceToken(connectionName),
          {
            strict: false,
          },
        );
        this.logger.log(
          `Successfully resolved DataSource for connection: ${connectionName}`,
        );
        this.checks.push(() => this.db.pingCheck(key, { connection: ds }));
      } catch (error) {
        this.logger.error(
          `Could not resolve DataSource for connection: ${connectionName}`,
          {
            error,
          },
        );
      }
    }

    this.checks.push(() =>
      this.memory.checkHeap(
        'memory_heap',
        this.serviceConfig.maxMemoryCheck * 1024 * 1024,
      ),
    );
  }

  @Get('health')
  @ApiResponse({
    status: HttpStatus.OK,
  })
  @ApiOperation({ summary: 'Checks if service is healthy' })
  @HealthCheck()
  check() {
    return this.health.check(this.checks);
  }

  @Get('config')
  @ApiResponse({
    status: HttpStatus.OK,
  })
  version() {
    return {
      name: this.appConfig.name,
      version: this.appConfig.version,
      env: this.appConfig.env,
      commitMessage: this.serviceConfig.commitMessage,
      commitSha: this.serviceConfig.commitSha,
      tz: this.appConfig.timezone,
      versions: process.versions,
    };
  }

  @Get('up')
  @ApiResponse({
    status: HttpStatus.OK,
  })
  up() {
    return {
      uptimeSeconds: process.uptime(),
    };
  }
}
