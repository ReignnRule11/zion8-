import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../../common/config/app-config.module';
import { AppConfigService } from '../../common/config/app-config.service';
import { LoggerModule } from '../../common/logger/logger.module';
import {
  EVENT_PUBLISHER,
  LoggingEventPublisher,
  WebhookEventPublisher,
  type EventPublisher,
} from './event-publisher.port';
import { OutboxRelay } from './outbox.relay';
import { OutboxService } from './outbox.service';

/**
 * Event infrastructure. Global so any feature module can write to the outbox in
 * its own transaction without importing the relay or the publisher.
 */
@Global()
@Module({
  imports: [AppConfigModule, LoggerModule],
  providers: [
    OutboxService,
    LoggingEventPublisher,
    WebhookEventPublisher,
    {
      provide: EVENT_PUBLISHER,
      useFactory: (
        config: AppConfigService,
        logging: LoggingEventPublisher,
        webhook: WebhookEventPublisher,
      ): EventPublisher => (config.outbox.webhookUrl ? webhook : logging),
      inject: [AppConfigService, LoggingEventPublisher, WebhookEventPublisher],
    },
    OutboxRelay,
  ],
  exports: [OutboxService, EVENT_PUBLISHER],
})
export class EventsModule {}
