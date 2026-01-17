import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { E2E } from '../constants';

/**
 * E2E WebSocket Client
 * Uses socket.io-client to connect to the WebSocket gateway
 */
export class WsClient {
  private socket: Socket | null = null;
  private receivedEvents: Map<string, unknown[]> = new Map();

  connect(accessToken: string, baseUrl: string = E2E.WS_URL): Socket {
    if (this.socket?.connected) {
      this.disconnect();
    }

    this.socket = io(baseUrl, {
      path: '/ws',
      auth: {
        token: `Bearer ${accessToken}`,
      },
      transports: ['websocket'],
      autoConnect: true,
    });

    // Capture all events
    this.socket.onAny((event: string, ...args: unknown[]) => {
      const events = this.receivedEvents.get(event) || [];
      events.push(args[0]);
      this.receivedEvents.set(event, events);
    });

    return this.socket;
  }

  /**
   * Wait for a specific event with timeout
   */
  waitForEvent<T = unknown>(
    eventName: string,
    timeoutMs = 5000,
    predicate: (data: T) => boolean = () => true, // Default: accept any event
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket not connected'));
      }

      // Create the timeout
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeoutMs);

      // Define the listener
      const listener = (data: T) => {
        // Only resolve if the data matches our criteria
        if (predicate(data)) {
          cleanup();
          resolve(data);
        }
        // Otherwise, ignore this event and keep waiting
      };

      // Cleanup helper to remove listener and clear timeout
      const cleanup = () => {
        clearTimeout(timeout);
        this.socket?.off(eventName, listener);
      };

      // Listen (use .on, not .once, so we can ignore non-matching events)
      this.socket.on(eventName, listener);
    });
  }

  /**
   * Wait for connection acknowledgment
   */
  waitForConnected(timeoutMs = 5000): Promise<{
    message: string;
    payload: { id: string; email: string };
  }> {
    return this.waitForEvent('connected', timeoutMs);
  }

  /**
   * Get all received events for a specific event name
   */
  getReceivedEvents(eventName: string): unknown[] {
    return this.receivedEvents.get(eventName) || [];
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, data?: unknown): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(event, data);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.receivedEvents.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
