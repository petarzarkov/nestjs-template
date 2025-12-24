import { ContextLogger } from '@/logger/services/context-logger.service';
import { Injectable } from '@nestjs/common';
import { EmailService } from './email/services/email.service';
import { EventsGateway } from './events/events.gateway';

@Injectable()
export class NotificationHandler {
  constructor(
    private readonly emailService: EmailService,
    private readonly eventsGateway: EventsGateway,
    private readonly logger: ContextLogger,
  ) {}

  // TODO: Use a messaging queue or redis publish/subscribe, or direct messaging to the user, any event sub
}
