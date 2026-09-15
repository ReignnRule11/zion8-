import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../common/config/app-config.module';
import { AppConfigService } from '../../common/config/app-config.service';
import { LoggerModule } from '../../common/logger/logger.module';
import { LoggingNotificationService } from './logging-notification.adapter';
import { NotificationService, type EmailMessage, type SmsMessage } from './notification.service';
import {
  ResendEmailNotificationService,
  TwilioSmsNotificationService,
} from './provider-notification.adapters';

class CompositeNotificationService extends NotificationService {
  constructor(
    private readonly email: NotificationService,
    private readonly sms: NotificationService,
  ) {
    super();
  }

  sendEmail(message: EmailMessage): Promise<void> {
    return this.email.sendEmail(message);
  }

  sendSms(message: SmsMessage): Promise<void> {
    return this.sms.sendSms(message);
  }
}

@Module({
  imports: [AppConfigModule, LoggerModule],
  providers: [
    LoggingNotificationService,
    ResendEmailNotificationService,
    TwilioSmsNotificationService,
    {
      provide: NotificationService,
      useFactory: (
        config: AppConfigService,
        logging: LoggingNotificationService,
        resend: ResendEmailNotificationService,
        twilio: TwilioSmsNotificationService,
      ) => {
        const email = config.notifications.resendApiKey ? resend : logging;
        const sms =
          config.notifications.twilioAccountSid && config.notifications.twilioAuthToken
            ? twilio
            : logging;
        return new CompositeNotificationService(email, sms);
      },
      inject: [
        AppConfigService,
        LoggingNotificationService,
        ResendEmailNotificationService,
        TwilioSmsNotificationService,
      ],
    },
  ],
  exports: [NotificationService, LoggingNotificationService],
})
export class NotificationsModule {}
