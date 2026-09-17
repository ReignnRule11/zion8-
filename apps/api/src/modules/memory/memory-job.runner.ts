import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../infrastructure/storage/object-storage.port';
import { ArtifactService } from './artifact.service';
import { detectContentType } from './memory.utils';

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;

type JobType =
  | 'METADATA'
  | 'EXTRACT'
  | 'TRANSCRIBE'
  | 'CATEGORIZE'
  | 'CHUNK'
  | 'EMBED'
  | 'INDEX'
  | 'GRAPH'
  | 'TIMELINE';

interface ClaimedJobRow {
  id: string;
  tenant_id: string;
  artifact_id: string;
  version_id: string | null;
  type: JobType;
  attempts: number;
  max_attempts: number;
}

type JobOutcome =
  { status: 'SUCCEEDED'; result?: Record<string, unknown> } | { status: 'BLOCKED'; reason: string };

/**
 * Runs memory processing jobs.
 *
 * Two properties matter more than throughput here:
 *
 * 1. Work is claimed with `FOR UPDATE SKIP LOCKED`, so several workers cooperate
 *    without ever processing the same job twice.
 * 2. A stage that cannot run because a capability is missing becomes BLOCKED with
 *    a named reason. It is never reported as successful, which is what keeps the
 *    archive honest about what the engine has actually read.
 */
@Injectable()
export class MemoryJobRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: ArtifactService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    if (!this.config.memoryWorker.enabled) {
      this.logger.log('Memory job worker disabled by configuration', 'MemoryJobRunner');
      return;
    }
    const { intervalMs } = this.config.memoryWorker;
    this.timer = setInterval(() => {
      this.drain().catch((error) =>
        this.logger.warn(
          `Memory worker drain failed: ${error instanceof Error ? error.message : String(error)}`,
          'MemoryJobRunner',
        ),
      );
    }, intervalMs);
    this.timer.unref();
    this.logger.log(`Memory job worker polling every ${intervalMs}ms`, 'MemoryJobRunner');
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    try {
      return await this.runOnce(this.config.memoryWorker.batchSize);
    } finally {
      this.running = false;
    }
  }

  /** Process one batch. Exposed so tests can drive the pipeline deterministically. */
  async runOnce(limit = this.config.memoryWorker.batchSize): Promise<number> {
    const rows = await this.claimBatch(limit);
    for (const row of rows) {
      await this.execute(row);
    }
    return rows.length;
  }

  private async claimBatch(limit: number): Promise<ClaimedJobRow[]> {
    return this.prisma.withoutScope(
      (tx) =>
        tx.$queryRaw<ClaimedJobRow[]>`
        UPDATE "memory_processing_jobs" AS j
        SET "status" = 'RUNNING', "started_at" = now(), "updated_at" = now()
        WHERE j."id" IN (
          SELECT "id" FROM "memory_processing_jobs"
          WHERE "status" = 'PENDING' AND "available_at" <= now()
            -- The table is shared with the indexing worker; this worker owns
            -- artifact jobs only, so the two never contend for one row.
            AND "artifact_id" IS NOT NULL
          ORDER BY "priority" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        RETURNING j."id", j."tenant_id", j."artifact_id", j."version_id",
                  j."type", j."attempts", j."max_attempts"
      `,
    );
  }

  private async execute(row: ClaimedJobRow): Promise<void> {
    try {
      const outcome = await this.dispatch(row);
      if (outcome.status === 'BLOCKED') {
        await this.markBlocked(row, outcome.reason);
        return;
      }
      await this.markSucceeded(row, outcome.result ?? {});
    } catch (error) {
      await this.markFailed(row, error);
    }
  }

  private dispatch(row: ClaimedJobRow): Promise<JobOutcome> {
    switch (row.type) {
      case 'METADATA':
        return this.runMetadata(row);
      case 'EXTRACT':
        return this.runExtract(row);
      case 'TRANSCRIBE':
        return this.runTranscribe(row);
      default:
        return Promise.resolve({ status: 'BLOCKED', reason: 'STAGE_NOT_AVAILABLE_YET' });
    }
  }

  /**
   * Metadata is where the file is actually identified. The ingest boundary also
   * sniffs as a guard, but the canonical detected type is written here, from the
   * bytes as they were stored, and the artifact is only marked READY once that
   * has happened.
   */
  private async runMetadata(row: ClaimedJobRow): Promise<JobOutcome> {
    const context = await this.artifacts.loadVersionContext(
      row.tenant_id,
      row.artifact_id,
      row.version_id,
    );
    const bytes = await this.storage.get(context.storageKey);
    const detected = detectContentType(bytes);

    if (detected) {
      await this.artifacts.applyDetectedType(row.tenant_id, context.versionId, detected);
    }
    await this.artifacts.markStatus(row.tenant_id, row.artifact_id, 'READY');

    return {
      status: 'SUCCEEDED',
      result: { detectedContentType: detected, sizeBytes: bytes.byteLength },
    };
  }

  private async runExtract(row: ClaimedJobRow): Promise<JobOutcome> {
    if (!this.config.memoryCapabilities.ocr) {
      await this.artifacts.markStatus(row.tenant_id, row.artifact_id, 'PARTIAL');
      return { status: 'BLOCKED', reason: 'OCR_NOT_CONFIGURED' };
    }
    return { status: 'BLOCKED', reason: 'STAGE_NOT_AVAILABLE_YET' };
  }

  private async runTranscribe(row: ClaimedJobRow): Promise<JobOutcome> {
    if (!this.config.memoryCapabilities.transcription) {
      await this.artifacts.markStatus(row.tenant_id, row.artifact_id, 'PARTIAL');
      return { status: 'BLOCKED', reason: 'TRANSCRIPTION_NOT_CONFIGURED' };
    }
    return { status: 'BLOCKED', reason: 'STAGE_NOT_AVAILABLE_YET' };
  }

  private async markSucceeded(row: ClaimedJobRow, result: Record<string, unknown>): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.memoryProcessingJob.update({
        where: { id: row.id },
        data: {
          status: 'SUCCEEDED',
          completedAt: new Date(),
          result: result as Prisma.InputJsonValue,
          lastError: null,
        },
      }),
    );
  }

  private async markBlocked(row: ClaimedJobRow, reason: string): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.memoryProcessingJob.update({
        where: { id: row.id },
        data: {
          status: 'BLOCKED',
          completedAt: new Date(),
          blockedReason: reason,
          lastError: null,
        },
      }),
    );
    this.logger.warn(`Memory job ${row.id} (${row.type}) blocked: ${reason}`, 'MemoryJobRunner');
  }

  private async markFailed(row: ClaimedJobRow, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = row.attempts >= row.max_attempts;
    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(row.attempts - 1, 0), MAX_BACKOFF_MS);

    await this.prisma.withoutScope((tx) =>
      tx.memoryProcessingJob.update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          lastError: message.slice(0, 4000),
          availableAt: exhausted ? new Date() : new Date(Date.now() + backoff),
          ...(exhausted ? { completedAt: new Date() } : {}),
        },
      }),
    );

    if (exhausted && row.type === 'METADATA') {
      await this.artifacts.markStatus(row.tenant_id, row.artifact_id, 'FAILED');
    }

    this.logger.warn(
      `Memory job ${row.id} (${row.type}) failed on attempt ${row.attempts}: ${message}`,
      'MemoryJobRunner',
    );
  }
}
