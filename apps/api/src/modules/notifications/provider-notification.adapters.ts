import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { DomainError } from '../../common/errors/domain-error';
import { NotificationService, type EmailMessage, type SmsMessage } from './notification.service';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

@Injectable()
export class ResendEmailNotificationService extends NotificationService {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    const { resendApiKey, emailFrom } = this.config.notifications;
    if (!resendApiKey) {
      throw DomainError.internal('Email provider is not configured');
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      throw DomainError.internal(`Email delivery failed with status ${response.status}`);
    }
  }

  async sendSms(): Promise<void> {
    throw DomainError.internal('Resend does not support SMS');
  }
}

@Injectable()
export class TwilioSmsNotificationService extends NotificationService {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  async sendEmail(): Promise<void> {
    throw DomainError.internal('Twilio does not support email');
  }

  async sendSms(message: SmsMessage): Promise<void> {
    const { twilioAccountSid, twilioAuthToken, smsFrom } = this.config.notifications;
    if (!twilioAccountSid || !twilioAuthToken || !smsFrom) {
      throw DomainError.internal('SMS provider is not configured');
    }

    const body = new URLSearchParams({ To: message.to, From: smsFrom, Body: message.body });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      throw DomainError.internal(`SMS delivery failed with status ${response.status}`);
    }
  }
}
