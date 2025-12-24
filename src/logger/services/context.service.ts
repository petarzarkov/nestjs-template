import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface AsyncContext {
  requestId?: string;
  userId?: string;
  method?: string;
  event?: string;
  context?: string;
  flow?: 'http' | 'rpc' | 'rmq' | 'http-external' | 'ws';
  [key: string]: unknown;
}

@Injectable()
export class ContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<AsyncContext>();

  getContext(): AsyncContext {
    const context = this.asyncLocalStorage.getStore();
    if (!context) {
      return {};
    }
    return { ...context };
  }

  updateContext(obj: Partial<AsyncContext>): void {
    const context = this.asyncLocalStorage.getStore();
    if (context) {
      Object.assign(context, obj);
    }
  }

  runWithContext<T>(context: AsyncContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }
}
