import { AppConfigService } from '@/config';
import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { ValidatedConfig } from '@/config/env.validation';
import { Controller, Get, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('service')
@Controller('service')
export class HealthController implements OnModuleInit {
  private appConfig: ValidatedServiceConfig['app'];
  private serviceConfig: ValidatedServiceConfig['service'];
  private checks: HealthIndicatorFunction[] = [];

  constructor(
    private configService: AppConfigService<ValidatedConfig>,
    private health: HealthCheckService,
    // private db: DrizzleHealthIndicator,
    private memory: MemoryHealthIndicator
    // private logger: ContextLogger
  ) {
    this.appConfig = this.configService.getOrThrow('app');
    this.serviceConfig = this.configService.getOrThrow('service');
  }

  onModuleInit() {
    // this.checks.push(() => this.db.pingCheck(key, { connection: ds }));

    this.checks.push(() =>
      this.memory.checkHeap('memory_heap', this.serviceConfig.maxMemoryCheck * 1024 * 1024)
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
