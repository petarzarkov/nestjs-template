import { HttpStatus, Optional } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Emitter } from '@socket.io/redis-emitter';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { ExtendedError, Socket } from 'socket.io';
import { AIService } from '@/ai/services/ai.service';
import type { Auth } from '@/auth/auth.config';
import { REQUEST_ID_HEADER_KEY } from '@/constants';
import { ContextLogger, ContextService } from '@arkv/nestjs-context-logger';
import { RedisService } from '@/infra/redis/services/redis.service';
import { EventMap, EventType } from '@/notifications/events/events';
import { UserRole } from '@/users/enum/user-role.enum';
import {
  AIMessageRequest,
  ChatMessage,
  ExtendedSocket,
  WebSocketBaseMessage,
  WebSocketEmitEvents,
  WSServer,
} from './events.dto';

export const ROOMS = {
  ADMINS: 'admins',
  CHAT: 'chat',
  user: (id: string) => `user_${id}`,
};

type NextFn = (error?: ExtendedError) => void;
type MiddlewareFn = (socket: Socket, next: NextFn) => Promise<void>;

/**
 * We will use the SocketConfigAdapter to configure the WebSocket gateway,
 * so we don't need to pass any options here.
 */
@WebSocketGateway()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: WSServer | null = null; // Null in Worker Process

  emitter: Emitter<WebSocketEmitEvents> | null = null; // Null in Main Process

  io!: WSServer | Emitter<WebSocketEmitEvents>;

  constructor(
    // Only used by the WS auth middleware, which runs in the main process
    // (where a WS server exists). Optional so the gateway can still be
    // constructed inside the sandboxed job-worker process — whose `JobModule`
    // context has no Better Auth `AuthModule` — where it is never used.
    @Optional() private readonly authService: AuthService<Auth> | undefined,
    private readonly logger: ContextLogger,
    private readonly contextService: ContextService,
    private readonly aiService: AIService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    // Check if we are in the worker process (where server is null)
    if (!this.server) {
      const redisClient = this.redisService.newConnection('emitter', {
        db: 4,
      });

      this.emitter = new Emitter(redisClient);
      this.io = this.emitter;
    } else {
      this.io = this.server;
    }

    if (!this.io) {
      throw new Error('Gateway IO not initialized');
    }
  }

  afterInit(server: WSServer) {
    server.use(this.#createContextMiddleware());
    server.use(this.#createAuthMiddleware());
  }

  /**
   * Context middleware - wraps the entire WS lifecycle with context and error handling.
   * This should be registered first to catch any errors from downstream middleware.
   */
  #createContextMiddleware(): MiddlewareFn {
    return async (socket: Socket, next: NextFn) => {
      const context = this.contextService.getContext();
      const requestId =
        (socket.handshake.headers?.[REQUEST_ID_HEADER_KEY] as string) ||
        context.requestId ||
        crypto.randomUUID();
      socket.handshake.headers[REQUEST_ID_HEADER_KEY] = requestId;

      void this.contextService.runWithContext(
        {
          ...context,
          flow: 'ws',
          context: 'EventsGateway',
          event: socket.handshake.url,
          requestId,
          forwardedFor: socket.handshake.headers['x-forwarded-for'],
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          contentType: socket.handshake.headers['content-type'],
          accept: socket.handshake.headers.accept,
          origin: socket.handshake.headers.origin,
        },
        async () => {
          try {
            next();
          } catch (error) {
            this.#handleMiddlewareError(error, next);
          }
        },
      );
    };
  }

  /**
   * Auth middleware - validates JWT token and attaches user to socket data.
   */
  #createAuthMiddleware(): MiddlewareFn {
    return async (socket: Socket, next: NextFn) => {
      try {
        const authHeader =
          socket.handshake.auth.token || socket.handshake.headers.authorization;

        if (!authHeader) {
          return next(
            this.#buildExtendedError(
              'Authentication token missing',
              HttpStatus.UNAUTHORIZED,
              'UNAUTHORIZED',
            ),
          );
        }

        if (!this.authService) {
          throw new Error('AuthService unavailable in this process');
        }

        const token = authHeader.split(' ')[1];
        const session = await this.authService.api.getSession({
          headers: fromNodeHeaders({ authorization: `Bearer ${token}` }),
        });
        if (!session?.user) {
          return next(
            this.#buildExtendedError(
              'Unauthorized',
              HttpStatus.UNAUTHORIZED,
              'UNAUTHORIZED',
            ),
          );
        }

        socket.data.user = session.user;
        this.contextService.updateContext({
          userId: session.user.id,
          userEmail: session.user.email,
          userRoles: session.user.role ? [session.user.role] : [],
        });

        next();
      } catch (error) {
        this.#handleMiddlewareError(error, next);
      }
    };
  }

  #handleMiddlewareError(error: unknown, next: NextFn): void {
    this.logger.error('WS Middleware Error', { error });

    if (error instanceof Error) {
      next(
        this.#buildExtendedError(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
          'INTERNAL_SERVER_ERROR',
        ),
      );
    } else {
      next(
        this.#buildExtendedError(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          'INTERNAL_SERVER_ERROR',
        ),
      );
    }
  }

  async handleConnection(client: ExtendedSocket) {
    const user = client.data.user;
    const userRoom = ROOMS.user(user.id);
    const rooms = [userRoom, ROOMS.CHAT];
    if (user.role === UserRole.ADMIN) {
      rooms.push(ROOMS.ADMINS);
    }

    await client.join(rooms);
    this.logger.log(
      `WS Connected: ${user.email} (${client.id}) joined rooms ${rooms.join(', ')}`,
      {
        payload: user,
      },
    );

    client.emit('connected', {
      message: `Connected to WS with id ${client.id}`,
      payload: user,
    });

    // Notify chat room that user joined
    this.io.to(ROOMS.CHAT).emit('userJoined', {
      username: user.name || user.email?.split('@')[0],
      timestamp: new Date(),
    });

    // Send user count
    const chatRoom = this.server?.sockets.adapter.rooms.get(ROOMS.CHAT);
    const userCount = chatRoom ? chatRoom.size : 0;
    this.io.to(ROOMS.CHAT).emit('userCount', userCount);
  }

  handleDisconnect(client: ExtendedSocket) {
    const user = client.data.user;

    this.logger.log(`WS Disconnected: ${client.id}`, {
      payload: user,
      requestId: client.handshake.headers[REQUEST_ID_HEADER_KEY],
    });

    // Notify chat room that user left
    if (user) {
      this.io.to(ROOMS.CHAT).emit('userLeft', {
        username: user.email,
        timestamp: new Date(),
      });

      // Send updated user count
      const chatRoom = this.server?.sockets.adapter.rooms.get(ROOMS.CHAT);
      const userCount = chatRoom ? chatRoom.size : 0;
      this.io.to(ROOMS.CHAT).emit('userCount', userCount);
    }
  }

  @SubscribeMessage('chatMessage')
  handleChatMessage(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    const user = client.data.user;
    const chatMessage: ChatMessage = {
      username: user.name || user.email?.split('@')[0],
      message: data.message,
      timestamp: new Date(),
      picture: user.image,
    };
    this.io.to(ROOMS.CHAT).emit('message', chatMessage);
    return { event: 'messageSent', data: { success: true } };
  }

  @SubscribeMessage('aiRequest')
  async handleAIRequest(
    @MessageBody()
    data: AIMessageRequest,
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    const requestId = crypto.randomUUID();
    const user = client.data.user;
    try {
      const stream = this.aiService.streamProvider(
        data.provider,
        data.model,
        data.prompt,
      );

      for await (const chunk of stream) {
        client.emit('aiMessageChunk', {
          requestId,
          chunk,
          provider: data.provider,
          model: data.model,
          done: false,
          username: user.name || user.email?.split('@')[0],
        });
      }

      // Send completion signal
      client.emit('aiMessageChunk', {
        requestId,
        chunk: '',
        provider: data.provider,
        model: data.model,
        done: true,
        username: user.name || user.email?.split('@')[0],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'AI request failed';
      const errorName = error instanceof Error ? error.name : 'UnknownError';

      this.logger.error('AI streaming failed', {
        errorMessage,
        errorName,
        provider: data.provider,
        model: data.model,
        requestId,
      });

      client.emit('aiError', {
        requestId,
        error: errorMessage,
        provider: data.provider,
        model: data.model,
        username: user.name || user.email?.split('@')[0],
      });
    }
  }

  sendNotification<K extends EventType, T extends EventMap[K]>(data: {
    /**
     * The user to send the notification to.
     */
    userId?: string;
    emitToAdmins?: boolean;
    eventType: K;
    payload: T;
  }) {
    const { userId, emitToAdmins, eventType, payload } = data || {};
    const rooms: string[] = [];

    if (userId) {
      rooms.push(ROOMS.user(userId));
    }

    if (emitToAdmins) {
      rooms.push(ROOMS.ADMINS);
    }

    if (rooms.length === 0) {
      this.logger.warn('No rooms to emit to', {
        eventType,
        payload,
      });
      return;
    }

    this.logger.verbose(
      `Emitting '${eventType}' to rooms ${rooms.join(', ')}`,
      {
        userId,
        emitToAdmins,
        eventType,
        payload,
        rooms: rooms.join(', '),
      },
    );

    this.io.to(rooms).emit('notification', {
      event: eventType,
      payload,
    });
  }

  sendGlobalNotification(payload: WebSocketBaseMessage) {
    this.logger.verbose(`Emitting to all`, {
      payload,
    });
    this.io.emit('global_notification', payload);
  }

  #buildExtendedError(
    message: string,
    status: HttpStatus,
    code: string,
  ): ExtendedError {
    const error: ExtendedError = new Error(message);
    error.data = { status, code };
    return error;
  }
}
