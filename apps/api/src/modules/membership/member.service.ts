import { Injectable } from '@nestjs/common';
import { Prisma, type Member as MemberRow } from '@prisma/client';
import type {
  MemberListQuery,
  MemberPage,
  MemberRequest,
  MemberResponse,
  MemberSummary,
  MemberUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TimelineService } from './timeline.service';
import {
  fullName,
  pageArgs,
  parseDateOnly,
  toIso,
} from './membership.utils';

@Injectable()
export class MemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async create(
    tenantId: string,
    actorUserId: string,
    input: MemberRequest,
  ): Promise<MemberResponse> {
    const joinedAt = parseDateOnly(input.joinedAt);

    try {
      const row = await this.prisma.withTenant(tenantId, async (tx) => {
        const created = await tx.member.create({
          data: {
            tenantId,
            firstName: input.firstName,
            middleName: input.middleName ?? null,
            lastName: input.lastName,
            preferredName: input.preferredName ?? null,
            status: input.status,
            gender: input.gender,
            maritalStatus: input.maritalStatus,
            dateOfBirth: parseDateOnly(input.dateOfBirth),
            email: input.email ?? null,
            phone: input.phone ?? null,
            photoUrl: input.photoUrl ?? null,
            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            city: input.city ?? null,
            region: input.region ?? null,
            postalCode: input.postalCode ?? null,
            countryCode: input.countryCode ?? null,
            joinedAt,
            baptizedAt: parseDateOnly(input.baptizedAt),
            notes: input.notes ?? null,
            tags: input.tags,
            customFields: input.customFields as Prisma.InputJsonValue,
            createdByUserId: actorUserId,
          },
        });

        await this.timeline.record(tx, {
          tenantId,
          memberId: created.id,
          type: 'MEMBERSHIP',
          occurredAt: joinedAt ?? created.createdAt,
          title: 'Joined the church',
          metadata: { status: created.status },
          sourceResourceType: 'member',
          sourceResourceId: created.id,
          dedupeKey: 'membership:created',
          createdByUserId: actorUserId,
        });

        return created;
      });

      return toMemberResponse(row);
    } catch (error) {
      throw translateMemberError(error);
    }
  }

  async get(tenantId: string, memberId: string): Promise<MemberResponse> {
    const row = await this.findRow(tenantId, memberId);
    return toMemberResponse(row);
  }

  async list(tenantId: string, query: MemberListQuery): Promise<MemberPage> {
    const where: Prisma.MemberWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.maritalStatus ? { maritalStatus: query.maritalStatus } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.departmentId
        ? { departmentMembers: { some: { departmentId: query.departmentId } } }
        : {}),
      ...(query.familyId ? { families: { some: { familyId: query.familyId } } } : {}),
      ...(query.volunteerRoleId
        ? { volunteerAssignments: { some: { roleId: query.volunteerRoleId } } }
        : {}),
      ...(query.joinedAfter || query.joinedBefore
        ? {
            joinedAt: {
              ...(query.joinedAfter ? { gte: parseDateOnly(query.joinedAfter) as Date } : {}),
              ...(query.joinedBefore ? { lte: parseDateOnly(query.joinedBefore) as Date } : {}),
            },
          }
        : {}),
      ...(query.search ? searchFilter(query.search) : {}),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.member.findMany({
          where,
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          skip,
          take,
          include: { _count: { select: { families: true, departmentMembers: true } } },
        }),
        tx.member.count({ where }),
      ]),
    );

    return {
      items: rows.map(toMemberSummary),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async update(
    tenantId: string,
    actorUserId: string,
    memberId: string,
    input: MemberUpdateRequest,
  ): Promise<MemberResponse> {
    await this.findRow(tenantId, memberId);

    const data = memberUpdateData(input);

    try {
      const row = await this.prisma.withTenant(tenantId, async (tx) => {
        const updated = await tx.member.update({ where: { id: memberId }, data });

        if (input.status === 'ARCHIVED' || input.status === 'TRANSFERRED') {
          await this.timeline.record(tx, {
            tenantId,
            memberId,
            type: 'MEMBERSHIP',
            title: input.status === 'ARCHIVED' ? 'Record archived' : 'Transferred out',
            metadata: { status: input.status },
            dedupeKey: `membership:status:${input.status}`,
            createdByUserId: actorUserId,
          });
        }

        return updated;
      });

      return toMemberResponse(row);
    } catch (error) {
      throw translateMemberError(error);
    }
  }

  /**
   * Archive, never delete. A church's pastoral record outlives the person's
   * membership, and hard-deleting it would take their attendance, relationships,
   * and documents with it.
   */
  async archive(
    tenantId: string,
    actorUserId: string,
    memberId: string,
  ): Promise<MemberResponse> {
    return this.update(tenantId, actorUserId, memberId, { status: 'ARCHIVED' });
  }

  async findRow(tenantId: string, memberId: string): Promise<MemberRow> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findFirst({ where: { id: memberId, tenantId } }),
    );
    if (!row) throw new DomainError('MEMBER_NOT_FOUND', 'That member could not be found');
    return row;
  }

  /** Guards cross-aggregate references (families, departments, attendance). */
  async assertExists(tenantId: string, memberId: string): Promise<void> {
    const found = await this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findFirst({ where: { id: memberId, tenantId }, select: { id: true } }),
    );
    if (!found) throw new DomainError('MEMBER_NOT_FOUND', 'That member could not be found');
  }
}

function searchFilter(search: string): Prisma.MemberWhereInput {
  return {
    OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { middleName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { preferredName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ],
  };
}

function memberUpdateData(input: MemberUpdateRequest): Prisma.MemberUpdateInput {
  const data: Prisma.MemberUpdateInput = {};

  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.middleName !== undefined) data.middleName = input.middleName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.preferredName !== undefined) data.preferredName = input.preferredName;
  if (input.status !== undefined) {
    data.status = input.status;
    data.archivedAt = input.status === 'ARCHIVED' ? new Date() : null;
  }
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.maritalStatus !== undefined) data.maritalStatus = input.maritalStatus;
  if (input.dateOfBirth !== undefined) data.dateOfBirth = parseDateOnly(input.dateOfBirth);
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl;
  if (input.addressLine1 !== undefined) data.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) data.addressLine2 = input.addressLine2;
  if (input.city !== undefined) data.city = input.city;
  if (input.region !== undefined) data.region = input.region;
  if (input.postalCode !== undefined) data.postalCode = input.postalCode;
  if (input.countryCode !== undefined) data.countryCode = input.countryCode;
  if (input.joinedAt !== undefined) data.joinedAt = parseDateOnly(input.joinedAt);
  if (input.baptizedAt !== undefined) data.baptizedAt = parseDateOnly(input.baptizedAt);
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.customFields !== undefined) {
    data.customFields = input.customFields as Prisma.InputJsonValue;
  }
  if (input.userId !== undefined) data.userId = input.userId;

  return data;
}

type MemberRowWithCounts = MemberRow & {
  _count: { families: number; departmentMembers: number };
};

function toMemberBase(row: MemberRow): MemberResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    firstName: row.firstName,
    middleName: row.middleName ?? undefined,
    lastName: row.lastName,
    preferredName: row.preferredName ?? undefined,
    status: row.status,
    gender: row.gender,
    maritalStatus: row.maritalStatus,
    dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    addressLine1: row.addressLine1 ?? undefined,
    addressLine2: row.addressLine2 ?? undefined,
    city: row.city ?? undefined,
    region: row.region ?? undefined,
    postalCode: row.postalCode ?? undefined,
    countryCode: row.countryCode ?? undefined,
    joinedAt: row.joinedAt ? row.joinedAt.toISOString().slice(0, 10) : undefined,
    baptizedAt: row.baptizedAt ? row.baptizedAt.toISOString().slice(0, 10) : undefined,
    notes: row.notes ?? undefined,
    tags: row.tags,
    customFields: (row.customFields ?? {}) as Record<string, string | number | boolean>,
    archivedAt: toIso(row.archivedAt),
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}

export function toMemberResponse(row: MemberRow): MemberResponse {
  return toMemberBase(row);
}

function toMemberSummary(row: MemberRowWithCounts): MemberSummary {
  return {
    id: row.id,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    preferredName: row.preferredName,
    fullName: fullName(row),
    status: row.status,
    gender: row.gender,
    email: row.email,
    phone: row.phone,
    photoUrl: row.photoUrl,
    joinedAt: toIso(row.joinedAt),
    userId: row.userId,
    tags: row.tags,
    familyCount: row._count.families,
    departmentCount: row._count.departmentMembers,
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}

function translateMemberError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]) : [];
    if (target.includes('email')) {
      return new DomainError(
        'MEMBER_EMAIL_TAKEN',
        'Another member in this workspace already uses that email address',
      );
    }
    return new DomainError('RESOURCE_CONFLICT', 'That member record conflicts with an existing one');
  }
  return error;
}
