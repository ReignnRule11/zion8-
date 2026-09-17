import { Injectable } from '@nestjs/common';
import { Prisma, type TimelineEventType } from '@prisma/client';
import {
  MANUAL_TIMELINE_TYPES,
  type TimelineEntryResponse,
  type TimelineNoteRequest,
  type TimelinePage,
  type TimelineQuery,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { pageArgs, requiredDate, toIso } from './membership.utils';

export interface TimelineWrite {
  tenantId: string;
  memberId: string;
  type: TimelineEventType;
  occurredAt?: Date;
  title: string;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue;
  sourceResourceType?: string | null;
  sourceResourceId?: string | null;
  /**
   * Idempotency key scoped to the member. Domain writes pass a deterministic
   * key (e.g. `attendance:<sessionId>`) so replaying an operation does not
   * duplicate the entry.
   */
  dedupeKey?: string | null;
  createdByUserId?: string | null;
}

interface TimelineRow {
  id: string;
  memberId: string;
  type: TimelineEventType;
  occurredAt: Date;
  title: string;
  summary: string | null;
  metadata: Prisma.JsonValue;
  sourceResourceType: string | null;
  sourceResourceId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append an entry inside the caller's transaction. Every aggregate writes its
   * timeline entry this way so the entry and the fact that produced it commit
   * or roll back together.
   */
  async record(tx: Prisma.TransactionClient, write: TimelineWrite): Promise<void> {
    if (write.dedupeKey) {
      const existing = await tx.memberTimelineEntry.findFirst({
        where: { memberId: write.memberId, dedupeKey: write.dedupeKey },
        select: { id: true },
      });
      if (existing) return;
    }

    await tx.memberTimelineEntry.create({
      data: {
        tenantId: write.tenantId,
        memberId: write.memberId,
        type: write.type,
        occurredAt: write.occurredAt ?? new Date(),
        title: write.title.slice(0, 160),
        summary: write.summary ?? null,
        metadata: write.metadata ?? {},
        sourceResourceType: write.sourceResourceType ?? null,
        sourceResourceId: write.sourceResourceId ?? null,
        dedupeKey: write.dedupeKey ?? null,
        createdByUserId: write.createdByUserId ?? null,
      },
    });
  }

  async list(tenantId: string, memberId: string, query: TimelineQuery): Promise<TimelinePage> {
    await this.assertMemberExists(tenantId, memberId);

    const where: Prisma.MemberTimelineEntryWhereInput = {
      tenantId,
      memberId,
      ...(query.types && query.types.length > 0 ? { type: { in: query.types } } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { summary: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const { skip, take } = pageArgs(query);

    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.memberTimelineEntry.findMany({
          where,
          orderBy: { occurredAt: 'desc' },
          skip,
          take,
        }),
        tx.memberTimelineEntry.count({ where }),
      ]),
    );

    return { items: rows.map(toResponse), total, limit: query.limit, offset: query.offset };
  }

  /** Notes are the only timeline entry a person authors by hand. */
  async addNote(
    tenantId: string,
    actorUserId: string,
    memberId: string,
    input: TimelineNoteRequest,
  ): Promise<TimelineEntryResponse> {
    await this.assertMemberExists(tenantId, memberId);

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const created = await tx.memberTimelineEntry.create({
        data: {
          tenantId,
          memberId,
          type: 'NOTE',
          occurredAt: input.occurredAt ? requiredDate(input.occurredAt) : new Date(),
          title: input.title,
          summary: input.summary ?? null,
          metadata: { manual: true },
          createdByUserId: actorUserId,
        },
      });
      return created;
    });

    return toResponse(row);
  }

  async deleteNote(tenantId: string, noteId: string): Promise<void> {
    const deleted = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberTimelineEntry.deleteMany({ where: { id: noteId, tenantId, type: 'NOTE' } }),
    );
    if (deleted.count === 0) {
      throw new DomainError('RESOURCE_NOT_FOUND', 'That note could not be found');
    }
  }

  /** Bumped whenever timeline-visible facts change; the summary reads it. */
  async countFor(tenantId: string, memberId: string): Promise<number> {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.memberTimelineEntry.count({ where: { tenantId, memberId } }),
    );
  }

  isManual(type: TimelineEventType): boolean {
    return MANUAL_TIMELINE_TYPES.includes(type as never);
  }

  private async assertMemberExists(tenantId: string, memberId: string): Promise<void> {
    const found = await this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findFirst({ where: { id: memberId, tenantId }, select: { id: true } }),
    );
    if (!found) throw new DomainError('MEMBER_NOT_FOUND', 'That member could not be found');
  }
}

function toResponse(row: TimelineRow): TimelineEntryResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    type: row.type,
    occurredAt: toIso(row.occurredAt) as string,
    title: row.title,
    summary: row.summary,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    sourceResourceType: row.sourceResourceType,
    sourceResourceId: row.sourceResourceId,
    createdByUserId: row.createdByUserId,
    createdAt: toIso(row.createdAt) as string,
  };
}
