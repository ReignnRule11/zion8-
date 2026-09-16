import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import type { Role } from '@zion8/contracts';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class OnboardingMailerService {
  constructor(
    private readonly notifications: NotificationService,
    private readonly config: AppConfigService,
  ) {}

  async sendAdministratorInvitation(input: {
    to: string;
    tenantName: string;
    inviterName: string | null;
    role: Role;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const link = `${this.config.webBaseUrl.replace(/\/+$/u, '')}/accept-invitation?token=${encodeURIComponent(input.token)}`;
    const inviter = input.inviterName ?? 'A church leader';
    const expires = input.expiresAt.toUTCString();

    await this.notifications.sendEmail({
      to: input.to,
      subject: `${inviter} invited you to ${input.tenantName} on Zion8`,
      text: [
        `${inviter} has invited you to help lead ${input.tenantName} on Zion8 as ${humanizeRole(input.role)}.`,
        '',
        'Accept your invitation and set up your account here:',
        link,
        '',
        `This invitation expires on ${expires}. If you were not expecting it, you can safely ignore this message.`,
      ].join('\n'),
    });
  }
}

function humanizeRole(role: Role): string {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
