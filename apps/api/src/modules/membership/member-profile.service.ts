import { Injectable } from '@nestjs/common';
import type { MemberProfile } from '@zion8/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AttendanceService } from './attendance.service';
import { DocumentService } from './documents/document.service';
import { MemberService } from './member.service';
import { RelationshipService } from './relationship.service';
import { SummaryService } from './summaries/summary.service';
import { TimelineService } from './timeline.service';
import { toIso } from './membership.utils';

const RECENT_ATTENDANCE = 10;
const RECENT_DOCUMENTS = 20;
const RECENT_TIMELINE = 20;
const MAX_RELATIONSHIPS = 100;

/**
 * Assembles the member profile projection from the aggregates that own each
 * part. Each piece is read through its own service, so the profile never
 * bypasses a domain boundary or duplicates a query that already exists.
 */
@Injectable()
export class MemberProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly relationships: RelationshipService,
    private readonly attendance: AttendanceService,
    private readonly documents: DocumentService,
    private readonly timeline: TimelineService,
    private readonly summaries: SummaryService,
  ) {}

  async get(tenantId: string, memberId: string): Promise<MemberProfile> {
    const member = await this.members.findRow(tenantId, memberId);

    const [
      familyRows,
      departmentRows,
      volunteerRows,
      relationshipPage,
      attendanceStats,
      attendanceRows,
      documentPage,
      timelinePage,
      summary,
    ] = await Promise.all([
      this.prisma.withTenant(tenantId, (tx) =>
        tx.familyMember.findMany({
          where: { tenantId, memberId },
          include: { family: { select: { id: true, name: true, status: true } } },
          orderBy: { createdAt: 'asc' },
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.departmentMember.findMany({
          where: { tenantId, memberId },
          include: { department: { select: { id: true, name: true, kind: true } } },
          orderBy: { createdAt: 'asc' },
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.volunteerAssignment.findMany({
          where: { tenantId, memberId },
          include: { role: { select: { id: true, name: true, commitment: true } } },
          orderBy: { createdAt: 'asc' },
        }),
      ),
      this.relationships.list(tenantId, { memberId, limit: MAX_RELATIONSHIPS, offset: 0 }),
      this.attendance.stats(tenantId, memberId),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.attendanceRecord.findMany({
          where: { tenantId, memberId },
          orderBy: { checkedInAt: 'desc' },
          take: RECENT_ATTENDANCE,
          include: {
            session: { select: { id: true, title: true, kind: true, occurredAt: true, status: true } },
          },
        }),
      ),
      this.documents.list(tenantId, memberId, { limit: RECENT_DOCUMENTS, offset: 0 }),
      this.timeline.list(tenantId, memberId, { limit: RECENT_TIMELINE, offset: 0 }),
      this.summaries.get(tenantId, memberId),
    ]);

    return {
      member: await this.members.get(tenantId, memberId),
      attendance: attendanceStats,
      families: familyRows.map((row) => ({
        familyId: row.family.id,
        familyName: row.family.name,
        familyStatus: row.family.status,
        role: row.role,
      })),
      departments: departmentRows.map((row) => ({
        departmentId: row.department.id,
        name: row.department.name,
        kind: row.department.kind,
        role: row.role,
        status: row.status,
      })),
      volunteerRoles: volunteerRows.map((row) => ({
        roleId: row.role.id,
        name: row.role.name,
        commitment: row.role.commitment,
        status: row.status,
      })),
      relationships: relationshipPage.items,
      recentAttendance: attendanceRows.map((row) => ({
        sessionId: row.session.id,
        title: row.session.title,
        kind: row.session.kind,
        occurredAt: toIso(row.session.occurredAt) as string,
        status: row.status,
      })),
      documents: documentPage.items,
      timeline: timelinePage.items,
      summary,
    };
  }
}
