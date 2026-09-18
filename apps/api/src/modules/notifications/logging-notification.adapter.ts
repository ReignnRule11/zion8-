import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  NotificationService,
  type EmailMessage,
  type PushMessage,
  type SmsMessage,
  type WhatsAppMessage,
} from './notification.service';

export interface CapturedNotification {
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  to: string;
  subject: string | null;
  body: string;
  sentAt: Date;
}

const BUFFER_LIMIT = 100;

/**
 * Development and test adapter. Delivery is recorded in memory so end-to-end
 * tests can assert on the exact code or token a user would receive. In
 * production the body is never logged, only that a message was dispatched.
 */
@Injectable()
export class LoggingNotificationService extends NotificationService {
  private readonly buffer: CapturedNotification[] = [];

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    this.capture({
      channel: 'email',
      to: message.to,
      subject: message.subject,
      body: message.text,
      sentAt: new Date(),
    });
  }

  async sendSms(message: SmsMessage): Promise<void> {
    this.capture({
      channel: 'sms',
      to: message.to,
      subject: null,
      body: message.body,
      sentAt: new Date(),
    });
  }

  async sendWhatsApp(message: WhatsAppMessage): Promise<void> {
    this.capture({
      channel: 'whatsapp',
      to: message.to,
      subject: null,
      body: message.body,
      sentAt: new Date(),
    });
  }

  async sendPush(message: PushMessage): Promise<void> {
    this.capture({
      channel: 'push',
      to: message.token,
      subject: message.title,
      body: message.body,
      sentAt: new Date(),
    });
  }

  recent(limit = 10): CapturedNotification[] {
    return this.buffer.slice(-limit);
  }

  lastFor(
    recipient: string,
    channel?: CapturedNotification['channel'],
  ): CapturedNotification | null {
    for (let index = this.buffer.length - 1; index >= 0; index -= 1) {
      const entry = this.buffer[index];
      if (!entry) continue;
      if (entry.to === recipient && (!channel || entry.channel === channel)) {
        return entry;
      }
    }
    return null;
  }

  clear(): void {
    this.buffer.length = 0;
  }

  private capture(entry: CapturedNotification): void {
    this.buffer.push(entry);
    if (this.buffer.length > BUFFER_LIMIT) {
      this.buffer.shift();
    }

    if (this.config.isProduction) {
      this.logger.log(`Dispatched ${entry.channel} to ${redact(entry.to)}`, 'NotificationService');
      return;
    }

    this.logger.debug(
      `${entry.channel} -> ${entry.to}${entry.subject ? ` | ${entry.subject}` : ''} | ${entry.body}`,
      'NotificationService',
    );
  }
}

function redact(recipient: string): string {
  if (recipient.includes('@')) {
    const [local = '', domain = ''] = recipient.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `***${recipient.slice(-4)}`;
}
