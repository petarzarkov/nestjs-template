import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { ValidatedConfig } from '@/config/env.validation';
import { AppConfigService } from '@/config/services/app.config.service';
import { HelpersService } from '@/helpers/services/helpers.service';
import { ContextLogger } from '@/logger';
import {
  InvitePayload,
  PasswordResetPayload,
  RegisteredPayload,
} from '@/notifications/dto/user-notifications.dto';
import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateEmailOptions, CreateEmailRequestOptions, Resend } from 'resend';
import InviteEmailTemplate from '../templates/invite-email';
import PasswordResetEmailTemplate from '../templates/password-reset-email';
import WelcomeEmailTemplate from '../templates/welcome-email';

@Injectable()
export class EmailService {
  private resend: Resend;
  private sender: string;
  private baseAppUrl: string;
  private maxEmailsPerSecond: number;
  private lastSentAt = 0;
  private sendQueue: Promise<unknown> = Promise.resolve();
  private appConfig: ValidatedServiceConfig['app'];
  private get minIntervalMs(): number {
    return Math.max(
      1,
      Math.floor(1000 / (Number(this.maxEmailsPerSecond) || 1)),
    );
  }

  constructor(
    private configService: AppConfigService<ValidatedConfig>,
    private logger: ContextLogger,
    private helpers: HelpersService,
  ) {
    const emailConfig = this.configService.get('email');
    this.resend = new Resend(emailConfig.apiKey);
    this.sender = emailConfig.sender;
    this.baseAppUrl = this.configService.get('app.webUrl');
    this.maxEmailsPerSecond = emailConfig.maxPerSecond;
    this.appConfig = this.configService.get('app');
  }

  async #sendEmail(
    payload: CreateEmailOptions,
    options?: CreateEmailRequestOptions,
  ) {
    if (this.appConfig.nodeEnv !== 'production') {
      this.logger.verbose(
        'Skipping email sending in non-production node environment',
        {
          subject: payload.subject,
        },
      );
      return;
    }
    await (this.sendQueue = this.sendQueue.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.minIntervalMs - (now - this.lastSentAt));
      if (waitMs > 0) await this.helpers.delay(waitMs);
      this.lastSentAt = Date.now();
    }));
    this.logger.log('Sending email', {
      subject: payload.subject,
    });

    const result = await this.resend.emails.send(payload, options);
    const { data, error } = result;

    if (error) {
      throw new InternalServerErrorException({
        name: error.name,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Unknown error occurred',
      });
    }

    return data;
  }

  async sendWelcomeEmail(payload: RegisteredPayload) {
    const { email, name } = payload;
    const result = await this.#sendEmail({
      from: this.sender,
      to: [email],
      subject: `Welcome to IISO, ${name}!`,
      react: WelcomeEmailTemplate({ name }),
    });

    return result;
  }

  async sendPasswordResetEmail(payload: PasswordResetPayload) {
    const { email, name, resetToken } = payload;
    const resetUrl = new URL('/reset-password', this.baseAppUrl);
    resetUrl.searchParams.set('token', resetToken);

    const result = await this.#sendEmail({
      from: this.sender,
      to: [email],
      subject: 'IISO Password Reset',
      react: PasswordResetEmailTemplate({
        name,
        resetUrl: resetUrl.toString(),
      }),
    });

    return result;
  }

  async sendInviteEmail(payload: InvitePayload) {
    const { invite } = payload;
    const { email, inviteCode, role, status } = invite;

    const inviteUrl = new URL('/invite-sign-up', this.baseAppUrl);
    inviteUrl.searchParams.set('inviteCode', inviteCode);
    inviteUrl.searchParams.set('email', email);
    inviteUrl.searchParams.set('role', role);
    inviteUrl.searchParams.set('status', status);

    const result = await this.#sendEmail({
      from: this.sender,
      to: [email],
      subject: `You have been invited to IISO, ${email}!`,
      react: InviteEmailTemplate({
        invite,
        inviteUrl: inviteUrl.toString(),
      }),
    });

    return result;
  }
}
