import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { AiIndexService } from './ai-index.service';

/**
 * Keeps the search index in step with the archive.
 *
 * It is a reconciliation loop rather than a queue consumer: each pass asks the
 * index service which sources need work and does it, so a restart, a missed
 * notification or a partially failed pass all converge. The loop is disabled
 * under tests, which call `runOnce` directly so that indexing is deterministic
 * rather than timing-dependent.
 */
@Injectable()
export class AiIndexRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly index: AiIndexService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    const { enabled, intervalMs } = this.config.aiWorker;
    if (!enabled) {
      this.logger.log('AI indexing worker disabled by configuration', 'AiIndexRunner');
      return;
    }
    this.timer = setInterval(() => {
      this.drain().catch((error) =>
        this.logger.warn(
          `AI indexing pass failed: ${error instanceof Error ? error.message : String(error)}`,
          'AiIndexRunner',
        ),
      );
    }, intervalMs);
    this.timer.unref();
    this.logger.log(`AI indexing worker polling every ${intervalMs}ms`, 'AiIndexRunner');
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    try {
      return await this.runOnce(this.config.aiWorker.batchSize);
    } finally {
      this.running = false;
    }
  }

  /** Index one batch. Exposed so tests can drive indexing without the timer. */
  async runOnce(limit = this.config.aiWorker.batchSize): Promise<number> {
    const sources = await this.index.findPending(limit);
    let processed = 0;
    for (const source of sources) {
      try {
        await this.index.indexSource(source);
        processed += 1;
      } catch (error) {
        // One bad source must not stall the pass; it stays FAILED and the next
        // pass will pick it up again.
        this.logger.warn(
          `Indexing version ${source.version_id} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          'AiIndexRunner',
        );
      }
    }

    const remaining = Math.max(limit - processed, 1);
    const sermons = await this.index.findPendingSermons(remaining);
    for (const sermon of sermons) {
      try {
        await this.index.indexSermon(sermon);
        processed += 1;
      } catch (error) {
        this.logger.warn(
          `Indexing sermon document ${sermon.document_id} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          'AiIndexRunner',
        );
      }
    }
    return processed;
  }
}
