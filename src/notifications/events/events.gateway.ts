import { HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ExtendedError, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { AIService } from '@/ai/services/ai.service';
import { AccessTokenPayload } from '@/auth/dto/access-token-payload';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { REQUEST_ID_HEADER_KEY } from '@/constants';
import { ContextService } from '@/infra/logger/services/context.service';
import { ContextLogger } from '@/infra/logger/services/context-logger.service';
import { EventMap, EventType } from '@/notifications/events/events';
import { UserRole } from '@/users/enum/user-role.enum';
import { UsersService } from '@/users/services/users.service';
import {
  AIMessageRequest,
  ChatMessage,
  ExtendedSocket,
  WebSocketBaseMessage,
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
@UsePipes(new ValidationPipe({ transform: true }))
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: WSServer;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService<ValidatedConfig>,
    private readonly logger: ContextLogger,
    private readonly usersService: UsersService,
    private readonly contextService: ContextService,
    private readonly aiService: AIService,
  ) {}

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
        uuidv4();
      socket.handshake.headers[REQUEST_ID_HEADER_KEY] = requestId;

      this.contextService.runWithContext(
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

        const token = authHeader.split(' ')[1];
        const payload = this.jwtService.verify<AccessTokenPayload>(token, {
          secret: this.configService.get('jwt.secret'),
        });

        const user = await this.usersService.findById(payload.sub);
        if (!user) {
          return next(
            this.#buildExtendedError(
              'Unauthorized',
              HttpStatus.UNAUTHORIZED,
              'UNAUTHORIZED',
            ),
          );
        }

        socket.data.user = user;
        this.contextService.updateContext({
          userId: user.id,
          userEmail: user.email,
          userRoles: user.roles,
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
    if (user.roles.includes(UserRole.ADMIN)) {
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
    this.server.to(ROOMS.CHAT).emit('userJoined', {
      username: user.displayName || user.email?.split('@')[0],
      timestamp: new Date(),
    });

    // Send user count
    const chatRoom = this.server.sockets.adapter.rooms.get(ROOMS.CHAT);
    const userCount = chatRoom ? chatRoom.size : 0;
    this.server.to(ROOMS.CHAT).emit('userCount', userCount);
  }

  handleDisconnect(client: ExtendedSocket) {
    const user = client.data.user;

    this.logger.log(`WS Disconnected: ${client.id}`, {
      payload: user,
      requestId: client.handshake.headers[REQUEST_ID_HEADER_KEY],
    });

    // Notify chat room that user left
    if (user) {
      this.server.to(ROOMS.CHAT).emit('userLeft', {
        username: user.email,
        timestamp: new Date(),
      });

      // Send updated user count
      const chatRoom = this.server.sockets.adapter.rooms.get(ROOMS.CHAT);
      const userCount = chatRoom ? chatRoom.size : 0;
      this.server.to(ROOMS.CHAT).emit('userCount', userCount);
    }
  }

  @SubscribeMessage('chatMessage')
  handleChatMessage(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    const user = client.data.user;
    const chatMessage: ChatMessage = {
      username: user.displayName || user.email?.split('@')[0],
      message: data.message,
      timestamp: new Date(),
      picture: user.picture,
    };
    this.server.to(ROOMS.CHAT).emit('message', chatMessage);
    return { event: 'messageSent', data: { success: true } };
  }

  @SubscribeMessage('aiRequest')
  async handleAIRequest(
    @MessageBody()
    data: AIMessageRequest,
    @ConnectedSocket() client: ExtendedSocket,
  ) {
    const requestId = uuidv4();
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
          username: user.displayName || user.email?.split('@')[0],
        });
      }

      // Send completion signal
      client.emit('aiMessageChunk', {
        requestId,
        chunk: '',
        provider: data.provider,
        model: data.model,
        done: true,
        username: user.displayName || user.email?.split('@')[0],
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
        username: user.displayName || user.email?.split('@')[0],
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

    this.server.to(rooms).emit('notification', {
      event: eventType,
      payload,
    });
  }

  sendGlobalNotification(payload: WebSocketBaseMessage) {
    this.logger.verbose(`Emitting to all`, {
      payload,
    });
    this.server.emit('global_notification', payload);
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
