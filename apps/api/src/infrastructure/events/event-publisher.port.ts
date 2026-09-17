import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/**
 * A domain event that must become visible to the rest of the platform. It is
 * persisted to the outbox in the same transaction as the state change that
 * produced it, which is what makes publication exactly-as-durable-as-the-data.
 */
export interface IntegrationEvent<TPayload = Record<string, unknown>> {
  id: string;
  tenantId: string | null;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  headers: Record<string, unknown>;
  occurredAt: string;
}

/**
 * Transport for the outbox relay. The domain never calls this directly; it
 * writes an event and the relay decides how to deliver it. Development logs the
 * event; production can point at a broker adapter without touching producers.
 */
export interface EventPublisher {
  publish(event: IntegrationEvent): Promise<void>;
}

@Injectable()
export class LoggingEventPublisher implements EventPublisher {
  constructor(private readonly logger: AppLogger) {}

  async publish(event: IntegrationEvent): Promise<void> {
    this.logger.log(
      `event=${event.type} aggregate=${event.aggregateType}:${event.aggregateId} tenant=${event.tenantId ?? 'platform'}`,
      'EventPublisher',
    );
  }
}

/**
 * HTTP adapter used when an integration endpoint (a broker bridge, an analytics
 * sink, a partner webhook) is configured. Failures propagate so the relay can
 * retry with backoff instead of dropping the event.
 */
@Injectable()
export class WebhookEventPublisher implements EventPublisher {
  constructor(private readonly config: AppConfigService) {}

  async publish(event: IntegrationEvent): Promise<void> {
    const url = this.config.outbox.webhookUrl;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Event webhook responded with status ${response.status}`);
    }
  }
}
