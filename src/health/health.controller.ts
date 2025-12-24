import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('service')
@Controller('service')
export class HealthController {
  private appConfig: ValidatedServiceConfig['app'];
  private serviceConfig: ValidatedServiceConfig['service'];
  private checks: HealthIndicatorFunction[] = [];

  constructor(
    private configService: AppConfigService<ValidatedConfig>,
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {
    this.appConfig = this.configService.getOrThrow('app');
    this.serviceConfig = this.configService.getOrThrow('service');

    this.checks.push(() => this.db.pingCheck('db'));

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
