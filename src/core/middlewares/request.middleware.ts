import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { v4, validate } from 'uuid';
import { REQUEST_ID_HEADER_KEY } from '@/constants';
import {
  AsyncContext,
  ContextService,
} from '@/logger/services/context.service';
import { ContextLogger } from '@/logger/services/context-logger.service';

@Injectable()
export class RequestMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const incomingReqId = req.get(REQUEST_ID_HEADER_KEY);
    const requestId =
      incomingReqId && validate(incomingReqId) ? incomingReqId : v4();
    const eventPath = req.originalUrl?.split('?')?.[0] || req.originalUrl;

    res.setHeader(REQUEST_ID_HEADER_KEY, requestId);
    res.locals.startTime = startTime;
    // Create context for the request
    const ctx: AsyncContext = {
      method: req.method,
      event: eventPath,
      requestId,
    };

    // Run the entire request lifecycle within the context
    this.contextService.runWithContext(ctx, () => {
      this.logger.log('Received Request', {
        ...(req.query && { query: req.query }),
        ...(req.body && { body: req.body }),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
        contentType: req.headers['content-type'],
        accept: req.headers.accept,
      });

      next();
    });
  }
}
