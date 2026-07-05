import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorFunction,
  HealthIndicatorResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { AppConfigService } from '@/config/services/app.config.service';
import { Public } from '@/core/decorators/public.decorator';
import { DRIZZLE_DB, type DrizzleDB } from '@/infra/db/database.module';

@ApiTags('service')
@Controller('service')
export class HealthController {
  private appConfig: ValidatedServiceConfig['app'];
  private serviceConfig: ValidatedServiceConfig['service'];
  private checks: HealthIndicatorFunction[] = [];

  constructor(
    private configService: AppConfigService,
    private health: HealthCheckService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private memory: MemoryHealthIndicator,
  ) {
    this.appConfig = this.configService.getOrThrow('app');
    this.serviceConfig = this.configService.getOrThrow('service');

    this.checks.push(() => this.checkDb());

    this.checks.push(() =>
      this.memory.checkHeap(
        'memory_heap',
        this.serviceConfig.maxMemoryCheck * 1024 * 1024,
      ),
    );
  }

  private checkDb(): HealthIndicatorResult {
    try {
      this.db.get(sql`select 1`);
      return { db: { status: 'up' } };
    } catch (error) {
      throw new HealthCheckError('Database check failed', {
        db: { status: 'down', message: (error as Error).message },
      });
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
