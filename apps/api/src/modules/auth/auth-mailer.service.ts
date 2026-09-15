import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class AuthMailerService {
  constructor(
    private readonly notifications: NotificationService,
    private readonly config: AppConfigService,
  ) {}

  async sendEmailVerification(input: { to: string; token: string }): Promise<void> {
    const link = this.webLink('/verify-email', input.token);
    await this.notifications.sendEmail({
      to: input.to,
      subject: 'Verify your Zion8 email address',
      text: `Confirm your email address to finish setting up your Zion8 account:\n\n${link}\n\nThis link expires in 15 minutes.`,
    });
  }

  async sendMagicLink(input: { to: string; token: string }): Promise<void> {
    const link = this.webLink('/magic-link', input.token);
    await this.notifications.sendEmail({
      to: input.to,
      subject: 'Your Zion8 sign-in link',
      text: `Use the link below to sign in to Zion8:\n\n${link}\n\nThis link expires in 15 minutes and can only be used once.`,
    });
  }

  async sendPasswordReset(input: { to: string; token: string }): Promise<void> {
    const link = this.webLink('/reset-password', input.token);
    await this.notifications.sendEmail({
      to: input.to,
      subject: 'Reset your Zion8 password',
      text: `We received a request to reset your Zion8 password:\n\n${link}\n\nIf this was not you, you can ignore this message. The link expires in 15 minutes.`,
    });
  }

  async sendEmailOtp(input: { to: string; code: string }): Promise<void> {
    await this.notifications.sendEmail({
      to: input.to,
      subject: 'Your Zion8 verification code',
      text: `Your Zion8 verification code is ${input.code}. It expires in 15 minutes.`,
    });
  }

  async sendSmsOtp(input: { to: string; code: string }): Promise<void> {
    await this.notifications.sendSms({
      to: input.to,
      body: `Your Zion8 verification code is ${input.code}. It expires in 15 minutes.`,
    });
  }

  private webLink(path: string, token: string): string {
    const base = this.config.webBaseUrl.replace(/\/+$/u, '');
    return `${base}${path}?token=${encodeURIComponent(token)}`;
  }
}
