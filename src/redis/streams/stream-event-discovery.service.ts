import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { STREAM_EVENT_METADATA } from './stream-event.decorator';

/**
 * Represents a handler for stream events.
 * Uses a generic type parameter to ensure type safety when calling handler methods.
 */
export interface StreamEventHandler<T = Record<string, unknown>> {
  instance: T;
  methodName: Extract<keyof T, string>;
  eventType: string;
}

/**
 * Service that discovers all methods decorated with @StreamEvent
 * and registers them as stream event handlers.
 */
@Injectable()
export class StreamEventDiscoveryService implements OnModuleInit {
  private handlers = new Map<string, StreamEventHandler>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly logger: ContextLogger,
  ) {}

  async onModuleInit() {
    this.discoverHandlers();
  }

  /**
   * Discovers all methods decorated with @StreamEvent across all providers.
   */
  private discoverHandlers(): void {
    const providers: InstanceWrapper<Record<string, unknown>>[] =
      this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || !Object.getPrototypeOf(instance)) {
        continue;
      }

      this.scanForEventHandlers(instance);
    }

    this.logger.log(`Discovered ${this.handlers.size} stream event handlers`, {
      handlers: Array.from(this.handlers.keys()).join(', '),
    });
  }

  /**
   * Scans a provider instance for methods decorated with @StreamEvent.
   */
  private scanForEventHandlers(instance: Record<string, unknown>): void {
    const prototype = Object.getPrototypeOf(instance);
    const methodNames = this.metadataScanner.getAllMethodNames(prototype);

    for (const methodName of methodNames) {
      const methodRef = prototype[methodName];
      const eventType = this.reflector.get<string>(
        STREAM_EVENT_METADATA,
        methodRef,
      );

      if (eventType) {
        if (this.handlers.has(eventType)) {
          this.logger.warn(
            `Duplicate handler for event type: ${eventType}. Overwriting previous handler.`,
          );
        }

        this.handlers.set(eventType, {
          instance,
          methodName,
          eventType,
        });
      }
    }
  }

  getHandler(eventType: string): StreamEventHandler | undefined {
    return this.handlers.get(eventType);
  }

  getAllHandlers(): Map<string, StreamEventHandler> {
    return this.handlers;
  }

  hasHandler(eventType: string): boolean {
    return this.handlers.has(eventType);
  }
}
