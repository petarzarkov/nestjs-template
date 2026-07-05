import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@/core/decorators/public.decorator';
import { renderQueueDashboard } from './queue-dashboard.view';
import { JobDispatcherService } from './services/job-dispatcher.service';

/**
 * Lightweight queue dashboard (replaces the old Bull Board). bunqueue's visual
 * dashboard is a separate beta product; this reads the embedded queues' stats
 * and renders them with React (`react-dom/server`, see queue-dashboard.view.tsx).
 * Mounted at `/api/queues`, protected by HtmlBasicAuthMiddleware (see main.ts)
 * and `@Public()` to bypass the JWT guard.
 */
@ApiExcludeController()
@Controller('queues')
export class QueueDashboardController {
  constructor(private readonly dispatcher: JobDispatcherService) {}

  @Public()
  @Get('stats')
  stats() {
    return this.dispatcher.getStats();
  }

  @Public()
  @Get()
  @Header('Content-Type', 'text/html')
  async page(): Promise<string> {
    const stats = await this.dispatcher.getStats();
    return renderQueueDashboard(stats);
  }
}
