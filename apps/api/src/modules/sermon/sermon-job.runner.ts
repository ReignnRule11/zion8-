import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SermonStage } from '@zion8/contracts';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SermonPipelineService, type StageOutcome } from './sermon-pipeline.service';
import { SermonService } from './sermon.service';

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;

interface ClaimedJobRow {
  id: string;
  tenant_id: string;
  sermon_id: string;
  type: SermonStage;
  priority: number;
  attempts: number;
  max_attempts: number;
}

/**
 * Runs sermon processing jobs.
 *
 * Work is claimed with `FOR UPDATE SKIP LOCKED` so several workers cooperate
 * without processing the same job twice. A stage that cannot run because a
 * capability is missing becomes BLOCKED with a named reason rather than a
 * successful empty result.
 */
@Injectable()
export class SermonJobRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: SermonPipelineService,
    private readonly sermons: SermonService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    if (!this.config.sermonWorker.enabled) {
      this.logger.log('Sermon job worker disabled by configuration', 'SermonJobRunner');
      return;
    }
    const { intervalMs } = this.config.sermonWorker;
    this.timer = setInterval(() => {
      this.drain().catch((error) =>
        this.logger.warn(
          `Sermon worker drain failed: ${error instanceof Error ? error.message : String(error)}`,
          'SermonJobRunner',
        ),
      );
    }, intervalMs);
    this.timer.unref();
    this.logger.log(`Sermon job worker polling every ${intervalMs}ms`, 'SermonJobRunner');
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    try {
      return await this.runOnce(this.config.sermonWorker.batchSize);
    } finally {
      this.running = false;
    }
  }

  /** Process one batch. Exposed so tests can drive the pipeline deterministically. */
  async runOnce(limit = this.config.sermonWorker.batchSize): Promise<number> {
    const rows = await this.claimBatch(limit);
    rows.sort((left, right) => left.priority - right.priority);
    for (const row of rows) {
      await this.execute(row);
    }
    return rows.length;
  }

  private async claimBatch(limit: number): Promise<ClaimedJobRow[]> {
    return this.prisma.withoutScope(
      (tx) =>
        tx.$queryRaw<ClaimedJobRow[]>`
        UPDATE "sermon_processing_jobs" AS j
        SET "status" = 'RUNNING',
            "started_at" = now(),
            "attempts" = j."attempts" + 1,
            "updated_at" = now()
        WHERE j."id" IN (
          SELECT "id" FROM "sermon_processing_jobs"
          WHERE "status" = 'PENDING' AND "available_at" <= now()
          ORDER BY "priority" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        RETURNING j."id", j."tenant_id", j."sermon_id", j."type", j."priority", j."attempts", j."max_attempts"
      `,
    );
  }

  private async execute(row: ClaimedJobRow): Promise<void> {
    try {
      const outcome: StageOutcome = await this.pipeline.runStage(
        row.tenant_id,
        row.sermon_id,
        row.type,
      );
      if (outcome.status === 'BLOCKED') {
        if (outcome.reason === 'TRANSCRIPT_REQUIRED' && (await this.transcriptStillPending(row))) {
          await this.requeue(row, outcome.reason);
          return;
        }
        await this.markBlocked(row, outcome.reason);
        await this.sermons.markReadyIfSettled(row.tenant_id, row.sermon_id);
        return;
      }
      await this.markSucceeded(row, outcome.result ?? {});
      await this.sermons.markReadyIfSettled(row.tenant_id, row.sermon_id);
    } catch (error) {
      await this.markFailed(row, error);
    }
  }

  private async markSucceeded(row: ClaimedJobRow, result: Record<string, unknown>): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.sermonProcessingJob.update({
        where: { id: row.id },
        data: {
          status: 'SUCCEEDED',
          completedAt: new Date(),
          result: result as Prisma.InputJsonValue,
          lastError: null,
          blockedReason: null,
        },
      }),
    );
  }

  private async transcriptStillPending(row: ClaimedJobRow): Promise<boolean> {
    const open = await this.prisma.withoutScope((tx) =>
      tx.sermonProcessingJob.count({
        where: {
          tenantId: row.tenant_id,
          sermonId: row.sermon_id,
          type: 'TRANSCRIBE',
          status: { in: ['PENDING', 'RUNNING'] },
          id: { not: row.id },
        },
      }),
    );
    return open > 0;
  }

  private async requeue(row: ClaimedJobRow, reason: string): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.sermonProcessingJob.update({
        where: { id: row.id },
        data: {
          status: 'PENDING',
          startedAt: null,
          availableAt: new Date(),
          lastError: reason,
          blockedReason: null,
        },
      }),
    );
  }

  private async markBlocked(row: ClaimedJobRow, reason: string): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.sermonProcessingJob.update({
        where: { id: row.id },
        data: {
          status: 'BLOCKED',
          completedAt: new Date(),
          blockedReason: reason,
          lastError: null,
        },
      }),
    );
    this.logger.warn(`Sermon job ${row.id} (${row.type}) blocked: ${reason}`, 'SermonJobRunner');
  }

  private async markFailed(row: ClaimedJobRow, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = row.attempts >= row.max_attempts;
    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(row.attempts - 1, 0), MAX_BACKOFF_MS);

    await this.prisma.withoutScope((tx) =>
      tx.sermonProcessingJob.update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          lastError: message.slice(0, 4000),
          availableAt: exhausted ? new Date() : new Date(Date.now() + backoff),
          ...(exhausted ? { completedAt: new Date() } : {}),
        },
      }),
    );

    this.logger.warn(
      `Sermon job ${row.id} (${row.type}) failed on attempt ${row.attempts}: ${message}`,
      'SermonJobRunner',
    );
  }
}
