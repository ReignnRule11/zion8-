import { Prisma, type AttendanceStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import {
  ATTENDING_STATUSES,
  type AttendanceBulkMarkRequest,
  type AttendanceMarkRequest,
  type AttendanceRecord,
  type AttendanceSessionListQuery,
  type AttendanceSessionPage,
  type AttendanceSessionRequest,
  type AttendanceSessionResponse,
  type AttendanceSessionUpdateRequest,
  type MemberAttendanceStats,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MemberService } from './member.service';
import { TimelineService } from './timeline.service';
import { VisitorService } from './visitor.service';
import { fullName, pageArgs, requiredDate, toIso } from './membership.utils';

const RECORD_INCLUDE = {
  member: { select: { firstName: true, middleName: true, lastName: true } },
  visitor: { select: { firstName: true, lastName: true } },
} satisfies Prisma.AttendanceRecordInclude;

type RecordWithAttendee = Prisma.AttendanceRecordGetPayload<{ include: typeof RECORD_INCLUDE }>;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly visitors: VisitorService,
    private readonly timeline: TimelineService,
  ) {}

  async createSession(
    tenantId: string,
    actorUserId: string,
    input: AttendanceSessionRequest,
  ): Promise<AttendanceSessionResponse> {
    if (input.departmentId) await this.assertDepartment(tenantId, input.departmentId);

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.attendanceSession.create({
        data: {
          tenantId,
          title: input.title,
          kind: input.kind,
          occurredAt: requiredDate(input.occurredAt),
          endedAt: input.endedAt ? requiredDate(input.endedAt) : null,
          location: input.location ?? null,
          departmentId: input.departmentId ?? null,
          expectedCount: input.expectedCount ?? null,
          notes: input.notes ?? null,
          recordedByUserId: actorUserId,
        },
        include: { records: { include: RECORD_INCLUDE } },
      }),
    );

    return toSessionResponse(row);
  }

  async getSession(tenantId: string, sessionId: string): Promise<AttendanceSessionResponse> {
    return toSessionResponse(await this.findSession(tenantId, sessionId));
  }

  async listSessions(
    tenantId: string,
    query: AttendanceSessionListQuery,
  ): Promise<AttendanceSessionPage> {
    const where: Prisma.AttendanceSessionWhereInput = {
      tenantId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: requiredDate(query.from) } : {}),
              ...(query.to ? { lte: requiredDate(query.to) } : {}),
            },
          }
        : {}),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.attendanceSession.findMany({
          where,
          orderBy: { occurredAt: 'desc' },
          skip,
          take,
          include: { _count: { select: { records: true } } },
        }),
        tx.attendanceSession.count({ where }),
      ]),
    );

    const sessionIds = rows.map((row) => row.id);
    const attendedBySession = await this.attendedCounts(tenantId, sessionIds);

    return {
      items: rows.map((row) => {
        const attended = attendedBySession.get(row.id) ?? 0;
        return {
          id: row.id,
          title: row.title,
          kind: row.kind,
          status: row.status,
          occurredAt: toIso(row.occurredAt) as string,
          location: row.location,
          departmentId: row.departmentId,
          attendedCount: attended,
          absentCount: Math.max(row._count.records - attended, 0),
          expectedCount: row.expectedCount,
          recordedByUserId: row.recordedByUserId,
          createdAt: toIso(row.createdAt) as string,
          updatedAt: toIso(row.updatedAt) as string,
        };
      }),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async updateSession(
    tenantId: string,
    sessionId: string,
    input: AttendanceSessionUpdateRequest,
  ): Promise<AttendanceSessionResponse> {
    const session = await this.findSession(tenantId, sessionId);
    if (session.status === 'CLOSED' && input.occurredAt) {
      throw new DomainError(
        'ATTENDANCE_SESSION_CLOSED',
        'A closed attendance session cannot be edited',
      );
    }
    if (input.departmentId) await this.assertDepartment(tenantId, input.departmentId);

    const data: Prisma.AttendanceSessionUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.occurredAt !== undefined) data.occurredAt = requiredDate(input.occurredAt);
    if (input.endedAt !== undefined) {
      data.endedAt = input.endedAt ? requiredDate(input.endedAt) : null;
    }
    if (input.location !== undefined) data.location = input.location;
    if (input.departmentId !== undefined) {
      data.department = input.departmentId
        ? { connect: { id: input.departmentId } }
        : { disconnect: true };
    }
    if (input.expectedCount !== undefined) data.expectedCount = input.expectedCount;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.attendanceSession.update({
        where: { id: sessionId },
        data,
        include: { records: { include: RECORD_INCLUDE } },
      }),
    );
    return toSessionResponse(row);
  }

  async closeSession(tenantId: string, sessionId: string): Promise<AttendanceSessionResponse> {
    const session = await this.findSession(tenantId, sessionId);
    if (session.status === 'CLOSED') {
      throw new DomainError('ATTENDANCE_SESSION_CLOSED', 'This attendance session is already closed');
    }

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.attendanceSession.update({
        where: { id: sessionId },
        data: { status: 'CLOSED' },
        include: { records: { include: RECORD_INCLUDE } },
      }),
    );
    return toSessionResponse(row);
  }

  async mark(
    tenantId: string,
    actorUserId: string,
    sessionId: string,
    input: AttendanceMarkRequest,
  ): Promise<AttendanceRecord> {
    const record = await this.markOne(tenantId, actorUserId, sessionId, input);
    return toRecord(record);
  }

  /** The normal path: a roster is submitted together after a service. */
  async bulkMark(
    tenantId: string,
    actorUserId: string,
    sessionId: string,
    input: AttendanceBulkMarkRequest,
  ): Promise<AttendanceRecord[]> {
    const session = await this.findSession(tenantId, sessionId);
    if (session.status === 'CLOSED') {
      throw new DomainError('ATTENDANCE_SESSION_CLOSED', 'This attendance session is closed');
    }

    for (const record of input.records) {
      if (!record.memberId && !record.visitorId) {
        throw new DomainError(
          'ATTENDANCE_ATTENDEE_REQUIRED',
          'Each attendance record needs a member or a visitor',
        );
      }
    }

    const rows = await this.prisma.withTenant(tenantId, async (tx) => {
      const saved: RecordWithAttendee[] = [];
      for (const record of input.records) {
        saved.push(await this.writeRecord(tx, tenantId, actorUserId, sessionId, record));
      }
      return saved;
    });

    return rows.map(toRecord);
  }

  async stats(tenantId: string, memberId: string): Promise<MemberAttendanceStats> {
    await this.members.assertExists(tenantId, memberId);

    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.attendanceRecord.findMany({
        where: { tenantId, memberId },
        orderBy: { checkedInAt: 'desc' },
        select: { status: true, checkedInAt: true },
        take: 500,
      }),
    );

    const sessionsRecorded = rows.length;
    const attended = rows.filter((row) => isAttending(row.status));
    const lastAttendedAt = attended[0]?.checkedInAt ?? null;

    let currentStreak = 0;
    for (const row of rows) {
      if (isAttending(row.status)) currentStreak += 1;
      else break;
    }

    return {
      memberId,
      sessionsAttended: attended.length,
      sessionsRecorded,
      attendanceRate: sessionsRecorded === 0 ? 0 : attended.length / sessionsRecorded,
      lastAttendedAt: toIso(lastAttendedAt),
      currentStreak,
    };
  }

  private async markOne(
    tenantId: string,
    actorUserId: string,
    sessionId: string,
    input: AttendanceMarkRequest,
  ): Promise<RecordWithAttendee> {
    const session = await this.findSession(tenantId, sessionId);
    if (session.status === 'CLOSED') {
      throw new DomainError('ATTENDANCE_SESSION_CLOSED', 'This attendance session is closed');
    }
    if (!input.memberId && !input.visitorId) {
      throw new DomainError(
        'ATTENDANCE_ATTENDEE_REQUIRED',
        'An attendance record needs a member or a visitor',
      );
    }

    return this.prisma.withTenant(tenantId, (tx) =>
      this.writeRecord(tx, tenantId, actorUserId, sessionId, input),
    );
  }

  /**
   * Upsert keyed on the attendee, so re-scanning a roster corrects a status
   * instead of creating a duplicate record.
   */
  private async writeRecord(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorUserId: string,
    sessionId: string,
    input: AttendanceMarkRequest,
  ): Promise<RecordWithAttendee> {
    if (input.memberId) await this.assertMemberInTx(tx, tenantId, input.memberId);
    if (input.visitorId) await this.assertVisitorInTx(tx, tenantId, input.visitorId);

    const checkedInAt = input.checkedInAt ? requiredDate(input.checkedInAt) : new Date();
    const attendeeKey = input.memberId
      ? { sessionId_memberId: { sessionId, memberId: input.memberId } }
      : { sessionId_visitorId: { sessionId, visitorId: input.visitorId as string } };

    const data = {
      status: input.status,
      method: input.method,
      checkedInAt,
      notes: input.notes ?? null,
      recordedByUserId: actorUserId,
    };

    const record = await tx.attendanceRecord.upsert({
      where: attendeeKey,
      create: {
        tenantId,
        sessionId,
        memberId: input.memberId ?? null,
        visitorId: input.visitorId ?? null,
        ...data,
      },
      update: data,
      include: RECORD_INCLUDE,
    });

    if (input.memberId) {
      const session = await tx.attendanceSession.findUniqueOrThrow({
        where: { id: sessionId },
        select: { title: true, occurredAt: true },
      });
      await this.timeline.record(tx, {
        tenantId,
        memberId: input.memberId,
        type: 'ATTENDANCE',
        occurredAt: checkedInAt,
        title: `Attended ${session.title}`,
        metadata: { status: input.status, sessionId },
        sourceResourceType: 'attendance_session',
        sourceResourceId: sessionId,
        dedupeKey: `attendance:${sessionId}`,
        createdByUserId: actorUserId,
      });
    }

    return record;
  }

  private async attendedCounts(
    tenantId: string,
    sessionIds: string[],
  ): Promise<Map<string, number>> {
    if (sessionIds.length === 0) return new Map();

    const grouped = await this.prisma.withTenant(tenantId, (tx) =>
      tx.attendanceRecord.groupBy({
        by: ['sessionId', 'status'],
        where: { tenantId, sessionId: { in: sessionIds } },
        _count: { _all: true },
      }),
    );

    const counts = new Map<string, number>();
    for (const row of grouped) {
      if (!isAttending(row.status)) continue;
      counts.set(row.sessionId, (counts.get(row.sessionId) ?? 0) + row._count._all);
    }
    return counts;
  }

  private async findSession(tenantId: string, sessionId: string) {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.attendanceSession.findFirst({
        where: { id: sessionId, tenantId },
        include: { records: { include: RECORD_INCLUDE, orderBy: { checkedInAt: 'asc' } } },
      }),
    );
    if (!row) {
      throw new DomainError('ATTENDANCE_SESSION_NOT_FOUND', 'That attendance session could not be found');
    }
    return row;
  }

  private async assertDepartment(tenantId: string, departmentId: string): Promise<void> {
    const found = await this.prisma.withTenant(tenantId, (tx) =>
      tx.department.findFirst({ where: { id: departmentId, tenantId }, select: { id: true } }),
    );
    if (!found) throw new DomainError('DEPARTMENT_NOT_FOUND', 'That department could not be found');
  }

  private async assertMemberInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    memberId: string,
  ): Promise<void> {
    const found = await tx.member.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true },
    });
    if (!found) throw new DomainError('MEMBER_NOT_FOUND', 'That member could not be found');
  }

  private async assertVisitorInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    visitorId: string,
  ): Promise<void> {
    const found = await tx.visitor.findFirst({
      where: { id: visitorId, tenantId },
      select: { id: true },
    });
    if (!found) throw new DomainError('VISITOR_NOT_FOUND', 'That visitor could not be found');
  }
}

function isAttending(status: AttendanceStatus): boolean {
  return (ATTENDING_STATUSES as readonly string[]).includes(status);
}

type SessionWithRecords = Prisma.AttendanceSessionGetPayload<{
  include: { records: { include: typeof RECORD_INCLUDE } };
}>;

function toRecord(row: RecordWithAttendee): AttendanceRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    memberId: row.memberId,
    visitorId: row.visitorId,
    attendeeName: row.member
      ? fullName(row.member)
      : row.visitor
        ? `${row.visitor.firstName} ${row.visitor.lastName}`.trim()
        : 'Unknown',
    status: row.status,
    method: row.method,
    checkedInAt: toIso(row.checkedInAt) as string,
    notes: row.notes,
    createdAt: toIso(row.createdAt) as string,
  };
}

function toSessionResponse(row: SessionWithRecords): AttendanceSessionResponse {
  const records = row.records.map(toRecord);
  const attendedCount = records.filter((record) => isAttending(record.status)).length;

  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    kind: row.kind,
    status: row.status,
    occurredAt: toIso(row.occurredAt) as string,
    endedAt: toIso(row.endedAt) ?? undefined,
    location: row.location ?? undefined,
    departmentId: row.departmentId ?? undefined,
    expectedCount: row.expectedCount ?? undefined,
    notes: row.notes ?? undefined,
    recordedByUserId: row.recordedByUserId,
    attendedCount,
    absentCount: Math.max(records.length - attendedCount, 0),
    records,
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}
