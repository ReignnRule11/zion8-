import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import type {
  DepartmentListQuery,
  DepartmentMember,
  DepartmentMemberAddRequest,
  DepartmentMemberUpdateRequest,
  DepartmentPage,
  DepartmentRequest,
  DepartmentResponse,
  DepartmentUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MemberService } from './member.service';
import { TimelineService } from './timeline.service';
import { fullName, pageArgs, toIso } from './membership.utils';

const DEPARTMENT_INCLUDE = {
  members: {
    include: {
      member: {
        select: { id: true, firstName: true, middleName: true, lastName: true, status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.DepartmentInclude;

type DepartmentWithMembers = Prisma.DepartmentGetPayload<{ include: typeof DEPARTMENT_INCLUDE }>;

@Injectable()
export class DepartmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly timeline: TimelineService,
  ) {}

  async create(tenantId: string, input: DepartmentRequest): Promise<DepartmentResponse> {
    if (input.leaderMemberId) await this.members.assertExists(tenantId, input.leaderMemberId);

    try {
      const row = await this.prisma.withTenant(tenantId, (tx) =>
        tx.department.create({
          data: {
            tenantId,
            name: input.name,
            kind: input.kind,
            description: input.description ?? null,
            leaderMemberId: input.leaderMemberId ?? null,
            meetingDay: input.meetingDay ?? null,
            meetingTime: input.meetingTime ?? null,
            location: input.location ?? null,
            isActive: input.isActive,
          },
          include: DEPARTMENT_INCLUDE,
        }),
      );
      return toResponse(row, await this.leaderName(tenantId, row.leaderMemberId));
    } catch (error) {
      throw translateDepartmentError(error);
    }
  }

  async get(tenantId: string, departmentId: string): Promise<DepartmentResponse> {
    const row = await this.findRow(tenantId, departmentId);
    return toResponse(row, await this.leaderName(tenantId, row.leaderMemberId));
  }

  async list(tenantId: string, query: DepartmentListQuery): Promise<DepartmentPage> {
    const where: Prisma.DepartmentWhereInput = {
      tenantId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.memberId ? { members: { some: { memberId: query.memberId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.department.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take,
          include: { _count: { select: { members: true } } },
        }),
        tx.department.count({ where }),
      ]),
    );

    const leaders = await this.leaderNames(
      tenantId,
      rows.map((row) => row.leaderMemberId).filter((id): id is string => Boolean(id)),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        description: row.description,
        isActive: row.isActive,
        memberCount: row._count.members,
        leaderMemberId: row.leaderMemberId,
        leaderName: row.leaderMemberId ? (leaders.get(row.leaderMemberId) ?? null) : null,
        meetingDay: row.meetingDay,
        meetingTime: row.meetingTime,
        createdAt: toIso(row.createdAt) as string,
        updatedAt: toIso(row.updatedAt) as string,
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async update(
    tenantId: string,
    departmentId: string,
    input: DepartmentUpdateRequest,
  ): Promise<DepartmentResponse> {
    await this.findRow(tenantId, departmentId);
    if (input.leaderMemberId) await this.members.assertExists(tenantId, input.leaderMemberId);

    const data: Prisma.DepartmentUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.description !== undefined) data.description = input.description;
    if (input.leaderMemberId !== undefined) {
      data.leaderMemberId = input.leaderMemberId;
    }
    if (input.meetingDay !== undefined) data.meetingDay = input.meetingDay;
    if (input.meetingTime !== undefined) data.meetingTime = input.meetingTime;
    if (input.location !== undefined) data.location = input.location;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    try {
      const row = await this.prisma.withTenant(tenantId, (tx) =>
        tx.department.update({ where: { id: departmentId }, data, include: DEPARTMENT_INCLUDE }),
      );
      return toResponse(row, await this.leaderName(tenantId, row.leaderMemberId));
    } catch (error) {
      throw translateDepartmentError(error);
    }
  }

  async addMember(
    tenantId: string,
    actorUserId: string,
    departmentId: string,
    input: DepartmentMemberAddRequest,
  ): Promise<DepartmentMember> {
    await this.findRow(tenantId, departmentId);
    await this.members.assertExists(tenantId, input.memberId);

    try {
      const row = await this.prisma.withTenant(tenantId, async (tx) => {
        const created = await tx.departmentMember.create({
          data: {
            tenantId,
            departmentId,
            memberId: input.memberId,
            role: input.role,
            joinedAt: input.joinedAt ? new Date(input.joinedAt) : new Date(),
          },
          include: DEPARTMENT_INCLUDE.members.include,
        });

        await this.timeline.record(tx, {
          tenantId,
          memberId: input.memberId,
          type: 'DEPARTMENT',
          title: `Joined ${await departmentName(tx, departmentId)}`,
          metadata: { role: input.role },
          sourceResourceType: 'department',
          sourceResourceId: departmentId,
          dedupeKey: `department:${departmentId}`,
          createdByUserId: actorUserId,
        });

        return created;
      });

      return toMember(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError(
          'DEPARTMENT_MEMBER_EXISTS',
          'That member already belongs to this department',
        );
      }
      throw error;
    }
  }

  async updateMember(
    tenantId: string,
    departmentId: string,
    memberId: string,
    input: DepartmentMemberUpdateRequest,
  ): Promise<DepartmentMember> {
    await this.findRow(tenantId, departmentId);

    const data: Prisma.DepartmentMemberUpdateInput = {};
    if (input.role !== undefined) data.role = input.role;
    if (input.status !== undefined) data.status = input.status;
    if (input.leftAt !== undefined) {
      data.leftAt = input.leftAt ? new Date(input.leftAt) : null;
      if (input.leftAt && input.status === undefined) data.status = 'INACTIVE';
    }

    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.departmentMember.updateMany({
        where: { tenantId, departmentId, memberId },
        data,
      }),
    );
    if (updated.count === 0) {
      throw new DomainError('DEPARTMENT_MEMBER_NOT_FOUND', 'That member is not in this department');
    }

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.departmentMember.findFirstOrThrow({
        where: { tenantId, departmentId, memberId },
        include: DEPARTMENT_INCLUDE.members.include,
      }),
    );
    return toMember(row);
  }

  async removeMember(
    tenantId: string,
    actorUserId: string,
    departmentId: string,
    memberId: string,
  ): Promise<void> {
    const deleted = await this.prisma.withTenant(tenantId, async (tx) => {
      const result = await tx.departmentMember.deleteMany({
        where: { tenantId, departmentId, memberId },
      });
      if (result.count > 0) {
        await this.timeline.record(tx, {
          tenantId,
          memberId,
          type: 'DEPARTMENT',
          title: `Left ${await departmentName(tx, departmentId)}`,
          sourceResourceType: 'department',
          sourceResourceId: departmentId,
          dedupeKey: `department:${departmentId}:left:${Date.now()}`,
          createdByUserId: actorUserId,
        });
      }
      return result;
    });

    if (deleted.count === 0) {
      throw new DomainError('DEPARTMENT_MEMBER_NOT_FOUND', 'That member is not in this department');
    }
  }

  private async findRow(tenantId: string, departmentId: string): Promise<DepartmentWithMembers> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.department.findFirst({
        where: { id: departmentId, tenantId },
        include: DEPARTMENT_INCLUDE,
      }),
    );
    if (!row) throw new DomainError('DEPARTMENT_NOT_FOUND', 'That department could not be found');
    return row;
  }

  private async leaderName(tenantId: string, memberId: string | null): Promise<string | null> {
    if (!memberId) return null;
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findFirst({
        where: { id: memberId, tenantId },
        select: { firstName: true, middleName: true, lastName: true },
      }),
    );
    return row ? fullName(row) : null;
  }

  private async leaderNames(tenantId: string, memberIds: string[]): Promise<Map<string, string>> {
    if (memberIds.length === 0) return new Map();
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findMany({
        where: { tenantId, id: { in: memberIds } },
        select: { id: true, firstName: true, middleName: true, lastName: true },
      }),
    );
    return new Map(rows.map((row) => [row.id, fullName(row)]));
  }
}

async function departmentName(
  tx: Prisma.TransactionClient,
  departmentId: string,
): Promise<string> {
  const row = await tx.department.findUniqueOrThrow({
    where: { id: departmentId },
    select: { name: true },
  });
  return row.name;
}

type DepartmentMemberRow = Prisma.DepartmentMemberGetPayload<{
  include: typeof DEPARTMENT_INCLUDE.members.include;
}>;

function toMember(row: DepartmentMemberRow): DepartmentMember {
  return {
    id: row.id,
    departmentId: row.departmentId,
    memberId: row.memberId,
    memberName: fullName(row.member),
    memberStatus: row.member.status,
    role: row.role,
    status: row.status,
    joinedAt: toIso(row.joinedAt) as string,
    leftAt: toIso(row.leftAt),
    createdAt: toIso(row.createdAt) as string,
  };
}

function toResponse(row: DepartmentWithMembers, leaderName: string | null): DepartmentResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    kind: row.kind,
    description: row.description ?? undefined,
    leaderMemberId: row.leaderMemberId ?? undefined,
    meetingDay: row.meetingDay as DepartmentResponse['meetingDay'],
    meetingTime: row.meetingTime ?? undefined,
    location: row.location ?? undefined,
    isActive: row.isActive,
    members: row.members.map(toMember),
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}

function translateDepartmentError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new DomainError(
      'DEPARTMENT_NAME_TAKEN',
      'A department with that name already exists in this workspace',
    );
  }
  return error;
}
