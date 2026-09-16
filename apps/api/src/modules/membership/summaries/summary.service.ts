import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  GenerateSummaryRequest,
  MemberAiSummaryFacts,
  MemberAiSummaryResponse,
} from '@zion8/contracts';
import { ATTENDING_STATUSES } from '@zion8/contracts';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { MemberService } from '../member.service';
import { TimelineService } from '../timeline.service';
import { fullName, toIso } from '../membership.utils';
import { SUMMARY_PROVIDER, type SummaryProvider, type SummaryTimelineItem } from './summary.provider';

const TIMELINE_PREVIEW = 25;

@Injectable()
export class SummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
    @Inject(SUMMARY_PROVIDER) private readonly provider: SummaryProvider,
  ) {}

  async get(tenantId: string, memberId: string): Promise<MemberAiSummaryResponse | null> {
    const member = await this.members.findRow(tenantId, memberId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberAiSummary.findUnique({ where: { memberId } }),
    );
    if (!row) return null;
    return toResponse(row, member.updatedAt);
  }

  /**
   * Generate and persist. Unless `force` is set, an existing summary that is
   * newer than the member record is returned as-is, so a page refresh does not
   * burn a provider call.
   */
  async generate(
    tenantId: string,
    actorUserId: string,
    memberId: string,
    input: GenerateSummaryRequest,
  ): Promise<MemberAiSummaryResponse> {
    const member = await this.members.findRow(tenantId, memberId);

    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberAiSummary.findUnique({ where: { memberId } }),
    );
    if (
      !input.force &&
      existing?.content &&
      existing.generatedAt &&
      existing.generatedAt >= member.updatedAt
    ) {
      return toResponse(existing, member.updatedAt);
    }

    const facts = await this.gatherFacts(tenantId, memberId, member);
    const timeline = await this.recentTimeline(tenantId, memberId);

    const draft = await this.provider.generate({
      member: {
        id: member.id,
        fullName: fullName(member),
        status: member.status,
        joinedAt: member.joinedAt ? member.joinedAt.toISOString().slice(0, 10) : null,
        tags: member.tags,
      },
      facts,
      timeline,
      focus: input.focus,
    });

    const sourceVersion = (existing?.sourceVersion ?? 0) + 1;
    const generatedAt = new Date();

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const saved = await tx.memberAiSummary.upsert({
        where: { memberId },
        create: {
          tenantId,
          memberId,
          status: 'FRESH',
          provider: draft.provider,
          model: draft.model,
          content: draft.content,
          highlights: draft.highlights,
          facts: facts as unknown as Prisma.InputJsonValue,
          generatedAt,
          sourceVersion,
        },
        update: {
          status: 'FRESH',
          provider: draft.provider,
          model: draft.model,
          content: draft.content,
          highlights: draft.highlights,
          facts: facts as unknown as Prisma.InputJsonValue,
          generatedAt,
          sourceVersion,
          error: null,
        },
      });

      await this.timeline.record(tx, {
        tenantId,
        memberId,
        type: 'SUMMARY',
        title: 'AI summary generated',
        metadata: { provider: draft.provider, sourceVersion },
        sourceResourceType: 'member_ai_summary',
        sourceResourceId: saved.id,
        dedupeKey: 'summary:generated',
        createdByUserId: actorUserId,
      });

      return saved;
    });

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'member.summary.generated',
      resourceType: 'member',
      resourceId: memberId,
      metadata: { provider: draft.provider, sourceVersion },
    });

    return toResponse(row, member.updatedAt);
  }

  private async gatherFacts(
    tenantId: string,
    memberId: string,
    member: { joinedAt: Date | null; createdAt: Date; tags: string[] },
  ): Promise<MemberAiSummaryFacts> {
    const since = member.joinedAt ?? member.createdAt;

    const [attendance, familyCount, relationshipCount, departmentCount, volunteerRoleCount, documentCount, openFollowUps] =
      await this.prisma.withTenant(tenantId, (tx) =>
        Promise.all([
          tx.attendanceRecord.findMany({
            where: { tenantId, memberId },
            orderBy: { checkedInAt: 'desc' },
            select: { status: true, checkedInAt: true },
            take: 500,
          }),
          tx.familyMember.count({ where: { tenantId, memberId } }),
          tx.memberRelationship.count({
            where: { tenantId, OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] },
          }),
          tx.departmentMember.count({ where: { tenantId, memberId, status: 'ACTIVE' } }),
          tx.volunteerAssignment.count({ where: { tenantId, memberId, status: 'ACTIVE' } }),
          tx.memberDocument.count({ where: { tenantId, memberId, status: { not: 'ARCHIVED' } } }),
          tx.visitor.count({
            where: {
              tenantId,
              invitedByMemberId: memberId,
              status: { in: ['NEW', 'FOLLOW_UP', 'RETURNING'] },
            },
          }),
        ]),
      );

    const attend = (status: string): boolean =>
      (ATTENDING_STATUSES as readonly string[]).includes(status);

    const sessionsRecorded = attendance.length;
    const attended = attendance.filter((record) => attend(record.status));
    let currentStreak = 0;
    for (const record of attendance) {
      if (attend(record.status)) currentStreak += 1;
      else break;
    }

    const timelineEventCount = await this.timeline.countFor(tenantId, memberId);
    const tenureDays = Math.max(
      0,
      Math.floor((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      tenureDays,
      attendanceRate: sessionsRecorded === 0 ? 0 : attended.length / sessionsRecorded,
      sessionsAttended: attended.length,
      sessionsRecorded,
      currentStreak,
      lastAttendedAt: toIso(attended[0]?.checkedInAt ?? null),
      familyCount,
      relationshipCount,
      departmentCount,
      volunteerRoleCount,
      documentCount,
      timelineEventCount,
      openFollowUps,
      tags: member.tags,
    };
  }

  private async recentTimeline(
    tenantId: string,
    memberId: string,
  ): Promise<SummaryTimelineItem[]> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberTimelineEntry.findMany({
        where: { tenantId, memberId },
        orderBy: { occurredAt: 'desc' },
        take: TIMELINE_PREVIEW,
        select: { type: true, title: true, occurredAt: true },
      }),
    );
    return rows.map((row) => ({
      type: row.type,
      title: row.title,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }
}

type SummaryRow = Prisma.MemberAiSummaryGetPayload<Record<string, never>>;

function toResponse(row: SummaryRow, memberUpdatedAt: Date): MemberAiSummaryResponse {
  const stale = row.generatedAt !== null && row.generatedAt < memberUpdatedAt;
  return {
    memberId: row.memberId,
    status: stale ? 'STALE' : row.status,
    provider: row.provider,
    model: row.model,
    content: row.content,
    highlights: row.highlights,
    facts: (row.facts ?? null) as MemberAiSummaryFacts | null,
    generatedAt: toIso(row.generatedAt),
    sourceVersion: row.sourceVersion,
    error: row.error,
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}

