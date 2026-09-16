import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import type {
  VolunteerAssignmentRequest,
  VolunteerAssignmentResponse,
  VolunteerAssignmentUpdateRequest,
  VolunteerRoleListQuery,
  VolunteerRolePage,
  VolunteerRoleRequest,
  VolunteerRoleResponse,
  VolunteerRoleUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MemberService } from './member.service';
import { TimelineService } from './timeline.service';
import { fullName, pageArgs, toIso } from './membership.utils';

const ASSIGNMENT_INCLUDE = {
  member: {
    select: { id: true, firstName: true, middleName: true, lastName: true, status: true },
  },
} satisfies Prisma.VolunteerAssignmentInclude;

const ROLE_INCLUDE = {
  department: { select: { id: true, name: true } },
  assignments: { include: ASSIGNMENT_INCLUDE, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.VolunteerRoleInclude;

type RoleWithAssignments = Prisma.VolunteerRoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

@Injectable()
export class VolunteerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly timeline: TimelineService,
  ) {}

  async createRole(tenantId: string, input: VolunteerRoleRequest): Promise<VolunteerRoleResponse> {
    if (input.departmentId) await this.assertDepartment(tenantId, input.departmentId);

    try {
      const row = await this.prisma.withTenant(tenantId, (tx) =>
        tx.volunteerRole.create({
          data: {
            tenantId,
            name: input.name,
            description: input.description ?? null,
            departmentId: input.departmentId ?? null,
            commitment: input.commitment,
            requiredCount: input.requiredCount,
            requiresBackgroundCheck: input.requiresBackgroundCheck,
            isActive: input.isActive,
          },
          include: ROLE_INCLUDE,
        }),
      );
      return toRoleResponse(row);
    } catch (error) {
      throw translateRoleError(error);
    }
  }

  async getRole(tenantId: string, roleId: string): Promise<VolunteerRoleResponse> {
    return toRoleResponse(await this.findRole(tenantId, roleId));
  }

  async listRoles(tenantId: string, query: VolunteerRoleListQuery): Promise<VolunteerRolePage> {
    const where: Prisma.VolunteerRoleWhereInput = {
      tenantId,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.commitment ? { commitment: query.commitment } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
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
        tx.volunteerRole.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take,
          include: {
            department: { select: { name: true } },
            _count: {
              select: { assignments: { where: { status: 'ACTIVE' } } },
            },
          },
        }),
        tx.volunteerRole.count({ where }),
      ]),
    );

    const items = rows
      .map((row) => {
        const activeCount = row._count.assignments;
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          departmentId: row.departmentId,
          departmentName: row.department?.name ?? null,
          commitment: row.commitment,
          requiredCount: row.requiredCount,
          activeCount,
          openSlots: Math.max(row.requiredCount - activeCount, 0),
          requiresBackgroundCheck: row.requiresBackgroundCheck,
          isActive: row.isActive,
          createdAt: toIso(row.createdAt) as string,
          updatedAt: toIso(row.updatedAt) as string,
        };
      })
      .filter((item) => !query.withOpenSlotsOnly || item.openSlots > 0);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    input: VolunteerRoleUpdateRequest,
  ): Promise<VolunteerRoleResponse> {
    await this.findRole(tenantId, roleId);
    if (input.departmentId) await this.assertDepartment(tenantId, input.departmentId);

    const data: Prisma.VolunteerRoleUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.departmentId !== undefined) {
      data.department = input.departmentId
        ? { connect: { id: input.departmentId } }
        : { disconnect: true };
    }
    if (input.commitment !== undefined) data.commitment = input.commitment;
    if (input.requiredCount !== undefined) data.requiredCount = input.requiredCount;
    if (input.requiresBackgroundCheck !== undefined) {
      data.requiresBackgroundCheck = input.requiresBackgroundCheck;
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;

    try {
      const row = await this.prisma.withTenant(tenantId, (tx) =>
        tx.volunteerRole.update({ where: { id: roleId }, data, include: ROLE_INCLUDE }),
      );
      return toRoleResponse(row);
    } catch (error) {
      throw translateRoleError(error);
    }
  }

  async assign(
    tenantId: string,
    actorUserId: string,
    roleId: string,
    input: VolunteerAssignmentRequest,
  ): Promise<VolunteerAssignmentResponse> {
    const role = await this.findRole(tenantId, roleId);
    await this.members.assertExists(tenantId, input.memberId);

    try {
      const row = await this.prisma.withTenant(tenantId, async (tx) => {
        const created = await tx.volunteerAssignment.create({
          data: {
            tenantId,
            roleId,
            memberId: input.memberId,
            status: input.status,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            backgroundCheckAt: input.backgroundCheckAt
              ? new Date(input.backgroundCheckAt)
              : null,
            notes: input.notes ?? null,
          },
          include: ASSIGNMENT_INCLUDE,
        });

        await this.timeline.record(tx, {
          tenantId,
          memberId: input.memberId,
          type: 'VOLUNTEER',
          title: `Serving as ${role.name}`,
          metadata: { roleId, status: input.status },
          sourceResourceType: 'volunteer_role',
          sourceResourceId: roleId,
          dedupeKey: `volunteer:${roleId}`,
          createdByUserId: actorUserId,
        });

        return created;
      });

      return toAssignment(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError(
          'VOLUNTEER_ASSIGNMENT_EXISTS',
          'That member is already assigned to this role',
        );
      }
      throw error;
    }
  }

  async updateAssignment(
    tenantId: string,
    roleId: string,
    assignmentId: string,
    input: VolunteerAssignmentUpdateRequest,
  ): Promise<VolunteerAssignmentResponse> {
    await this.findRole(tenantId, roleId);

    const data: Prisma.VolunteerAssignmentUpdateInput = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.startsAt !== undefined) {
      data.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    }
    if (input.endsAt !== undefined) {
      data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    }
    if (input.backgroundCheckAt !== undefined) {
      data.backgroundCheckAt = input.backgroundCheckAt
        ? new Date(input.backgroundCheckAt)
        : null;
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.volunteerAssignment.updateMany({ where: { id: assignmentId, tenantId, roleId }, data }),
    );
    if (updated.count === 0) {
      throw new DomainError('VOLUNTEER_ASSIGNMENT_NOT_FOUND', 'That assignment could not be found');
    }

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.volunteerAssignment.findFirstOrThrow({
        where: { id: assignmentId, tenantId },
        include: ASSIGNMENT_INCLUDE,
      }),
    );
    return toAssignment(row);
  }

  async endAssignment(tenantId: string, roleId: string, assignmentId: string): Promise<void> {
    const deleted = await this.prisma.withTenant(tenantId, (tx) =>
      tx.volunteerAssignment.deleteMany({ where: { id: assignmentId, tenantId, roleId } }),
    );
    if (deleted.count === 0) {
      throw new DomainError('VOLUNTEER_ASSIGNMENT_NOT_FOUND', 'That assignment could not be found');
    }
  }

  private async findRole(tenantId: string, roleId: string): Promise<RoleWithAssignments> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.volunteerRole.findFirst({ where: { id: roleId, tenantId }, include: ROLE_INCLUDE }),
    );
    if (!row) throw new DomainError('VOLUNTEER_ROLE_NOT_FOUND', 'That volunteer role could not be found');
    return row;
  }

  private async assertDepartment(tenantId: string, departmentId: string): Promise<void> {
    const found = await this.prisma.withTenant(tenantId, (tx) =>
      tx.department.findFirst({ where: { id: departmentId, tenantId }, select: { id: true } }),
    );
    if (!found) throw new DomainError('DEPARTMENT_NOT_FOUND', 'That department could not be found');
  }
}

type AssignmentRow = Prisma.VolunteerAssignmentGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;

function toAssignment(row: AssignmentRow): VolunteerAssignmentResponse {
  return {
    id: row.id,
    roleId: row.roleId,
    memberId: row.memberId,
    memberName: fullName(row.member),
    memberStatus: row.member.status,
    status: row.status,
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),
    backgroundCheckAt: toIso(row.backgroundCheckAt),
    notes: row.notes,
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}

function toRoleResponse(row: RoleWithAssignments): VolunteerRoleResponse {
  const assignments = row.assignments.map(toAssignment);
  const activeCount = assignments.filter((assignment) => assignment.status === 'ACTIVE').length;

  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description ?? undefined,
    departmentId: row.departmentId ?? undefined,
    commitment: row.commitment,
    requiredCount: row.requiredCount,
    requiresBackgroundCheck: row.requiresBackgroundCheck,
    isActive: row.isActive,
    assignments,
    activeCount,
    openSlots: Math.max(row.requiredCount - activeCount, 0),
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}

function translateRoleError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new DomainError(
      'RESOURCE_CONFLICT',
      'A volunteer role with that name already exists in this workspace',
    );
  }
  return error;
}
