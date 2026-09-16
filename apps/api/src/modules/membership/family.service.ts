import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import type {
  FamilyListQuery,
  FamilyMemberAddRequest,
  FamilyPage,
  FamilyRequest,
  FamilyResponse,
  FamilyUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MemberService } from './member.service';
import { TimelineService } from './timeline.service';
import { fullName, pageArgs, toIso } from './membership.utils';

const FAMILY_INCLUDE = {
  members: {
    include: {
      member: {
        select: { id: true, firstName: true, middleName: true, lastName: true, status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.FamilyInclude;

type FamilyWithMembers = Prisma.FamilyGetPayload<{ include: typeof FAMILY_INCLUDE }>;

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly timeline: TimelineService,
  ) {}

  async create(tenantId: string, input: FamilyRequest): Promise<FamilyResponse> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.family.create({
        data: {
          tenantId,
          name: input.name,
          status: input.status,
          addressLine1: input.addressLine1 ?? null,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          region: input.region ?? null,
          postalCode: input.postalCode ?? null,
          countryCode: input.countryCode ?? null,
          homePhone: input.homePhone ?? null,
          notes: input.notes ?? null,
        },
        include: FAMILY_INCLUDE,
      }),
    );
    return toFamilyResponse(row);
  }

  async get(tenantId: string, familyId: string): Promise<FamilyResponse> {
    const row = await this.findRow(tenantId, familyId);
    return toFamilyResponse(row);
  }

  async list(tenantId: string, query: FamilyListQuery): Promise<FamilyPage> {
    const where: Prisma.FamilyWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.memberId ? { members: { some: { memberId: query.memberId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.family.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take,
          include: { _count: { select: { members: true } } },
        }),
        tx.family.count({ where }),
      ]),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        city: row.city,
        memberCount: row._count.members,
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
    familyId: string,
    input: FamilyUpdateRequest,
  ): Promise<FamilyResponse> {
    await this.findRow(tenantId, familyId);

    const data: Prisma.FamilyUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.status !== undefined) data.status = input.status;
    if (input.addressLine1 !== undefined) data.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) data.addressLine2 = input.addressLine2;
    if (input.city !== undefined) data.city = input.city;
    if (input.region !== undefined) data.region = input.region;
    if (input.postalCode !== undefined) data.postalCode = input.postalCode;
    if (input.countryCode !== undefined) data.countryCode = input.countryCode;
    if (input.homePhone !== undefined) data.homePhone = input.homePhone;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.family.update({ where: { id: familyId }, data, include: FAMILY_INCLUDE }),
    );
    return toFamilyResponse(row);
  }

  async addMember(
    tenantId: string,
    actorUserId: string,
    familyId: string,
    input: FamilyMemberAddRequest,
  ): Promise<FamilyResponse> {
    await this.findRow(tenantId, familyId);
    await this.members.assertExists(tenantId, input.memberId);

    try {
      await this.prisma.withTenant(tenantId, async (tx) => {
        await tx.familyMember.create({
          data: { tenantId, familyId, memberId: input.memberId, role: input.role },
        });
        await this.timeline.record(tx, {
          tenantId,
          memberId: input.memberId,
          type: 'FAMILY',
          title: `Added to household as ${input.role.toLowerCase().replace('_', ' ')}`,
          sourceResourceType: 'family',
          sourceResourceId: familyId,
          dedupeKey: `family:${familyId}`,
          createdByUserId: actorUserId,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('FAMILY_MEMBER_EXISTS', 'That member is already in this household');
      }
      throw error;
    }

    return this.get(tenantId, familyId);
  }

  async removeMember(
    tenantId: string,
    actorUserId: string,
    familyId: string,
    memberId: string,
  ): Promise<FamilyResponse> {
    const deleted = await this.prisma.withTenant(tenantId, async (tx) => {
      const result = await tx.familyMember.deleteMany({ where: { tenantId, familyId, memberId } });
      if (result.count > 0) {
        await this.timeline.record(tx, {
          tenantId,
          memberId,
          type: 'FAMILY',
          title: 'Removed from household',
          sourceResourceType: 'family',
          sourceResourceId: familyId,
          dedupeKey: `family:${familyId}:removed:${Date.now()}`,
          createdByUserId: actorUserId,
        });
      }
      return result;
    });

    if (deleted.count === 0) {
      throw new DomainError('FAMILY_MEMBER_NOT_FOUND', 'That member is not in this household');
    }
    return this.get(tenantId, familyId);
  }

  private async findRow(tenantId: string, familyId: string): Promise<FamilyWithMembers> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.family.findFirst({ where: { id: familyId, tenantId }, include: FAMILY_INCLUDE }),
    );
    if (!row) throw new DomainError('FAMILY_NOT_FOUND', 'That household could not be found');
    return row;
  }
}

function toFamilyResponse(row: FamilyWithMembers): FamilyResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    status: row.status,
    addressLine1: row.addressLine1 ?? undefined,
    addressLine2: row.addressLine2 ?? undefined,
    city: row.city ?? undefined,
    region: row.region ?? undefined,
    postalCode: row.postalCode ?? undefined,
    countryCode: row.countryCode ?? undefined,
    homePhone: row.homePhone ?? undefined,
    notes: row.notes ?? undefined,
    members: row.members.map((member) => ({
      id: member.id,
      familyId: member.familyId,
      memberId: member.memberId,
      memberName: fullName(member.member),
      memberStatus: member.member.status,
      role: member.role,
      createdAt: toIso(member.createdAt) as string,
    })),
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}
