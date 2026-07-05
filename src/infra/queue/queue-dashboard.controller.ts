import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@/core/decorators/public.decorator';
import { JobDispatcherService } from './services/job-dispatcher.service';

/**
 * Lightweight queue dashboard (replaces the old Bull Board). bunqueue's visual
 * dashboard is a separate beta product; this reads the embedded queues' stats.
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
    const rows = Object.entries(stats)
      .map(([queue, counts]) => {
        const cells = Object.entries(counts)
          .map(([key, value]) => `<td>${key}<b>${String(value)}</b></td>`)
          .join('');
        return `<tr><th>${queue}</th>${cells}</tr>`;
      })
      .join('');

    return `<!doctype html><html><head><title>Queues</title>
<meta http-equiv="refresh" content="5"><meta name="color-scheme" content="light dark">
<style>body{font-family:system-ui,sans-serif;margin:2rem;max-width:900px}
h1{font-size:1.2rem}table{border-collapse:collapse;width:100%}
th,td{border:1px solid color-mix(in srgb,currentColor 20%,transparent);padding:.5rem .75rem;text-align:left;font-weight:400}
th{background:color-mix(in srgb,currentColor 8%,transparent)}b{margin-left:.35rem}</style></head>
<body><h1>bunqueue queues</h1><table><tbody>${rows || '<tr><td>No queues registered</td></tr>'}</tbody></table>
<p><small>auto-refresh 5s · <a href="queues/stats">JSON</a></small></p></body></html>`;
  }
}
