import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import type { IntegrationEvent } from './event-publisher.port';

const MAX_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;

/** A claimed outbox row, as returned by the `FOR UPDATE SKIP LOCKED` query. */
interface ClaimedOutboxRow {
  id: string;
  tenant_id: string | null;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  headers: unknown;
  attempts: number;
  created_at: Date;
}

/**
 * The transactional outbox.
 *
 * `enqueue` is called with the same transaction client that writes the domain
 * change, so either both commit or neither does — there is no window in which an
 * artifact exists without its event, or an event without its artifact.
 *
 * The relay claims work with `FOR UPDATE SKIP LOCKED`, which lets several relay
 * instances run concurrently without duplicating a delivery or blocking on each
 * other.
 */
@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async enqueue(
    tx: Prisma.TransactionClient,
    event: IntegrationEvent,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: event.id,
        tenantId: event.tenantId,
        eventType: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as Prisma.InputJsonValue,
        headers: event.headers as Prisma.InputJsonValue,
        status: 'PENDING',
        availableAt: new Date(event.occurredAt),
      },
    });
  }

  /**
   * Atomically mark a batch of due events as PUBLISHING and return them. Only
   * the claiming instance sees these rows, so two relays never publish the same
   * event at the same time.
   */
  async claimBatch(limit: number): Promise<ClaimedOutboxRow[]> {
    return this.prisma.withoutScope((tx) =>
      tx.$queryRaw<ClaimedOutboxRow[]>`
        UPDATE "outbox_events" AS o
        SET "status" = 'PUBLISHING', "attempts" = o."attempts" + 1, "updated_at" = now()
        WHERE o."id" IN (
          SELECT "id" FROM "outbox_events"
          WHERE "status" IN ('PENDING', 'FAILED')
            AND "available_at" <= now()
          ORDER BY "available_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        RETURNING o."id", o."tenant_id", o."event_type", o."aggregate_type",
                  o."aggregate_id", o."payload", o."headers", o."attempts", o."created_at"
      `,
    );
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.withoutScope((tx) =>
      tx.outboxEvent.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), lastError: null },
      }),
    );
  }

  /**
   * A failed delivery returns to the queue with exponential backoff until the
   * attempt budget is exhausted, at which point it is parked as FAILED with the
   * last error preserved for an operator to inspect.
   */
  async markFailed(id: string, attempts: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = attempts >= MAX_ATTEMPTS;
    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);

    await this.prisma.withoutScope((tx) =>
      tx.outboxEvent.update({
        where: { id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          lastError: message.slice(0, 4000),
          availableAt: exhausted ? new Date() : new Date(Date.now() + backoff),
        },
      }),
    );

    if (exhausted) {
      this.logger.error(`Outbox event ${id} exhausted its retries`, message, 'OutboxService');
    } else {
      this.logger.warn(`Outbox event ${id} failed, retrying in ${backoff}ms`, 'OutboxService');
    }
  }

  toIntegrationEvent(row: ClaimedOutboxRow): IntegrationEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      headers: (row.headers ?? {}) as Record<string, unknown>,
      occurredAt: new Date(row.created_at).toISOString(),
    };
  }
}
