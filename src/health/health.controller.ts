import { Controller, Get, HttpStatus } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
  MicroserviceHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';

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
    private microservice: MicroserviceHealthIndicator,
  ) {
    this.appConfig = this.configService.getOrThrow('app');
    this.serviceConfig = this.configService.getOrThrow('service');
    const redisConfig = this.configService.get('redis');

    this.checks.push(() => this.db.pingCheck('db'));

    this.checks.push(() =>
      this.memory.checkHeap(
        'memory_heap',
        this.serviceConfig.maxMemoryCheck * 1024 * 1024,
      ),
    );

    // Add Redis health check if Redis is configured
    if (redisConfig?.host) {
      this.checks.push(() =>
        this.microservice.pingCheck('redis', {
          transport: Transport.REDIS,
          options: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
          },
        }),
      );
    }
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
    const redisConfig = this.configService.get('redis');
    return {
      name: this.appConfig.name,
      version: this.appConfig.version,
      env: this.appConfig.env,
      commitMessage: this.serviceConfig.commitMessage,
      commitSha: this.serviceConfig.commitSha,
      tz: this.appConfig.timezone,
      redis: redisConfig
        ? {
            enabled: true,
            cacheEnabled: redisConfig.cache.enabled,
            throttleEnabled: redisConfig.throttle.enabled,
            wsAdapterEnabled: redisConfig.wsAdapterEnabled,
            streamsEnabled: redisConfig.streams.enabled,
          }
        : { enabled: false },
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
