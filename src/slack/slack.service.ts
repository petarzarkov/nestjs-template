import { ValidatedServiceConfig } from '@/config/dto/service-vars.dto';
import { AppConfigService } from '@/config/services/app.config.service';
import { ContextLogger } from '@/logger/services/context-logger.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SlackService {
  private readonly slackConfig: ValidatedServiceConfig['slack'];
  private readonly appConfig: ValidatedServiceConfig['app'];
  private readonly serviceConfig: ValidatedServiceConfig['service'];
  private canSendMessage = false;

  constructor(
    private readonly configService: AppConfigService<ValidatedServiceConfig>,
    private readonly logger: ContextLogger,
  ) {
    this.slackConfig = this.configService.get('slack');
    this.appConfig = this.configService.get('app');
    this.serviceConfig = this.configService.get('service');
    this.canSendMessage =
      this.slackConfig.botToken !== undefined &&
      this.slackConfig.botToken !== '';
  }

  async sendMessage(message: string, emoji: `:${string}:` = ':awesome_cylon:') {
    if (!this.canSendMessage) {
      return;
    }

    try {
      await fetch(`https://slack.com/api/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.slackConfig.botToken}`,
        },
        body: JSON.stringify({
          channel: this.slackConfig.channel,
          username: this.appConfig.name,
          icon_emoji: emoji,
          attachments: [
            {
              color: '#d3d9e3',
              pretext: message,
              fallback: message,
              title: `Commit: ${this.serviceConfig.commitSha || 'dev-sha'}`,
              fields: [
                {
                  title: 'Name',
                  value: this.appConfig.name,
                  short: true,
                },
                {
                  title: 'Version',
                  value: this.appConfig.version,
                  short: true,
                },
                {
                  title: 'Environment',
                  value: this.appConfig.env,
                  short: true,
                },
                {
                  title: 'Node Environment',
                  value: this.appConfig.nodeEnv,
                  short: true,
                },
                ...(this.serviceConfig.commitMessage
                  ? [
                      {
                        title: 'Commit Message',
                        value: this.serviceConfig.commitMessage,
                        short: false,
                      },
                    ]
                  : []),
              ],
              footer: this.appConfig.name,
              footer_icon:
                'https://emoji.slack-edge.com/T4WRCSVM0/lime/425fa9df3cfcc179.png',
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });
    } catch (error) {
      this.logger.error('Failed to send Slack message', { error });
    }
  }
}
