import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;

@Module({
  imports: [
    TerminusModule.forRoot({
      gracefulShutdownTimeoutMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
