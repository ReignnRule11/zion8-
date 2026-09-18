import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { EVENT_PUBLISHER, type EventPublisher } from './event-publisher.port';
import { OutboxService } from './outbox.service';

/**
 * Drains the transactional outbox.
 *
 * The relay is deliberately a poller rather than an in-transaction side effect:
 * publishing inside the domain transaction would put a network call inside a
 * database transaction and could still lose the event. Polling the committed
 * outbox is slower by a few milliseconds and correct by construction.
 *
 * A single instance guards against overlapping runs; multiple instances are safe
 * because `claimBatch` uses `SKIP LOCKED`.
 */
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  onModuleInit(): void {
    if (!this.config.outbox.relayEnabled) {
      this.logger.log('Outbox relay disabled by configuration', 'OutboxRelay');
      return;
    }
    const { pollIntervalMs } = this.config.outbox;
    this.timer = setInterval(() => {
      this.drain().catch((error) =>
        this.logger.warn(
          `Outbox drain failed: ${error instanceof Error ? error.message : String(error)}`,
          'OutboxRelay',
        ),
      );
    }, pollIntervalMs);
    this.timer.unref();
    this.logger.log(`Outbox relay polling every ${pollIntervalMs}ms`, 'OutboxRelay');
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** Execute one drain cycle. Exposed so tests can drive the relay deterministically. */
  async drain(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    try {
      const rows = await this.outbox.claimBatch(this.config.outbox.batchSize);
      let published = 0;
      for (const row of rows) {
        const event = this.outbox.toIntegrationEvent(row);
        try {
          await this.publisher.publish(event);
          await this.outbox.markPublished(row.id);
          published += 1;
        } catch (error) {
          await this.outbox.markFailed(row.id, row.attempts, error);
        }
      }
      return published;
    } finally {
      this.running = false;
    }
  }
}
