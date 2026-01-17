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
import { AppConfigService } from '@/config/services/app.config.service';
import { Public } from '@/core/decorators/public.decorator';

@ApiTags('service')
@Controller('service')
export class HealthController {
  private appConfig: ValidatedServiceConfig['app'];
  private serviceConfig: ValidatedServiceConfig['service'];
  private checks: HealthIndicatorFunction[] = [];

  constructor(
    private configService: AppConfigService,
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

  @Public()
  @Get('health')
  @ApiResponse({
    status: HttpStatus.OK,
  })
  @ApiOperation({ summary: 'Checks if service is healthy' })
  @HealthCheck()
  check() {
    return this.health.check(this.checks);
  }

  @Public()
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
      versions: {
        bun: process.versions.bun,
        node: process.versions.node,
      },
    };
  }

  @Public()
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
