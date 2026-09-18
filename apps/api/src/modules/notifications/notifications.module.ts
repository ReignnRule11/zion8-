import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../common/config/app-config.module';
import { AppConfigService } from '../../common/config/app-config.service';
import { LoggerModule } from '../../common/logger/logger.module';
import { AuditModule } from '../audit/audit.module';
import { LoggingNotificationService } from './logging-notification.adapter';
import {
  NotificationService,
  type EmailMessage,
  type PushMessage,
  type SmsMessage,
  type WhatsAppMessage,
} from './notification.service';
import { NotificationCampaignService } from './notification-campaign.service';
import { NotificationController } from './notification.controller';
import { NotificationInboxService } from './notification-inbox.service';
import { NotificationJobRunner } from './notification-job.runner';
import { NotificationTemplateService } from './notification-template.service';
import {
  HttpPushNotificationService,
  ResendEmailNotificationService,
  TwilioSmsNotificationService,
  TwilioWhatsAppNotificationService,
} from './provider-notification.adapters';

class CompositeNotificationService extends NotificationService {
  constructor(
    private readonly email: NotificationService,
    private readonly sms: NotificationService,
    private readonly whatsapp: NotificationService,
    private readonly push: NotificationService,
  ) {
    super();
  }

  sendEmail(message: EmailMessage): Promise<void> {
    return this.email.sendEmail(message);
  }

  sendSms(message: SmsMessage): Promise<void> {
    return this.sms.sendSms(message);
  }

  sendWhatsApp(message: WhatsAppMessage): Promise<void> {
    return this.whatsapp.sendWhatsApp(message);
  }

  sendPush(message: PushMessage): Promise<void> {
    return this.push.sendPush(message);
  }
}

@Module({
  imports: [AppConfigModule, LoggerModule, AuditModule],
  controllers: [NotificationController],
  providers: [
    LoggingNotificationService,
    ResendEmailNotificationService,
    TwilioSmsNotificationService,
    TwilioWhatsAppNotificationService,
    HttpPushNotificationService,
    {
      provide: NotificationService,
      useFactory: (
        config: AppConfigService,
        logging: LoggingNotificationService,
        resend: ResendEmailNotificationService,
        twilio: TwilioSmsNotificationService,
        whatsapp: TwilioWhatsAppNotificationService,
        push: HttpPushNotificationService,
      ) => {
        const email = config.notifications.resendApiKey ? resend : logging;
        const sms =
          config.notifications.twilioAccountSid && config.notifications.twilioAuthToken
            ? twilio
            : logging;
        const whatsappTransport =
          config.notifications.twilioAccountSid &&
          config.notifications.twilioAuthToken &&
          config.notifications.whatsappFrom
            ? whatsapp
            : logging;
        const pushTransport = config.notifications.pushEndpoint ? push : logging;
        return new CompositeNotificationService(email, sms, whatsappTransport, pushTransport);
      },
      inject: [
        AppConfigService,
        LoggingNotificationService,
        ResendEmailNotificationService,
        TwilioSmsNotificationService,
        TwilioWhatsAppNotificationService,
        HttpPushNotificationService,
      ],
    },
    NotificationTemplateService,
    NotificationCampaignService,
    NotificationInboxService,
    NotificationJobRunner,
  ],
  exports: [
    NotificationService,
    LoggingNotificationService,
    NotificationCampaignService,
    NotificationJobRunner,
  ],
})
export class NotificationsModule {}
