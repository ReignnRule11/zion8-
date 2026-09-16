import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import type {
  VisitorConvertRequest,
  VisitorListQuery,
  VisitorPage,
  VisitorRequest,
  VisitorResponse,
  VisitorUpdateRequest,
  VisitorVisitRequest,
  VisitorVisitResponse,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TimelineService } from './timeline.service';
import { pageArgs, requiredDate, toIso } from './membership.utils';

const VISITOR_INCLUDE = {
  visits: { orderBy: { occurredAt: 'desc' } },
} satisfies Prisma.VisitorInclude;

type VisitorWithVisits = Prisma.VisitorGetPayload<{ include: typeof VISITOR_INCLUDE }>;

@Injectable()
export class VisitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async create(
    tenantId: string,
    _actorUserId: string,
    input: VisitorRequest,
  ): Promise<VisitorResponse> {
    const firstVisitAt = input.firstVisitAt ? requiredDate(input.firstVisitAt) : null;

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.visitor.create({
        data: {
          tenantId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          status: input.status,
          source: input.source,
          firstVisitAt,
          lastVisitAt: firstVisitAt,
          visitCount: firstVisitAt ? 1 : 0,
          invitedByMemberId: input.invitedByMemberId ?? null,
          assignedToUserId: input.assignedToUserId ?? null,
          addressLine1: input.addressLine1 ?? null,
          city: input.city ?? null,
          countryCode: input.countryCode ?? null,
          interests: input.interests,
          notes: input.notes ?? null,
          followUpAt: input.followUpAt ? requiredDate(input.followUpAt) : null,
        },
        include: VISITOR_INCLUDE,
      }),
    );

    return toResponse(row);
  }

  async get(tenantId: string, visitorId: string): Promise<VisitorResponse> {
    return toResponse(await this.findRow(tenantId, visitorId));
  }

  async list(tenantId: string, query: VisitorListQuery): Promise<VisitorPage> {
    const where: Prisma.VisitorWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
      ...(query.followUpBefore ? { followUpAt: { lte: requiredDate(query.followUpBefore) } } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.visitor.findMany({
          where,
          orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
          skip,
          take,
        }),
        tx.visitor.count({ where }),
      ]),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: `${row.firstName} ${row.lastName}`.trim(),
        email: row.email,
        phone: row.phone,
        status: row.status,
        source: row.source,
        firstVisitAt: toIso(row.firstVisitAt),
        lastVisitAt: toIso(row.lastVisitAt),
        visitCount: row.visitCount,
        assignedToUserId: row.assignedToUserId,
        followUpAt: toIso(row.followUpAt),
        convertedMemberId: row.convertedMemberId,
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
    visitorId: string,
    input: VisitorUpdateRequest,
  ): Promise<VisitorResponse> {
    await this.findRow(tenantId, visitorId);

    const data: Prisma.VisitorUpdateInput = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.status !== undefined) data.status = input.status;
    if (input.source !== undefined) data.source = input.source;
    if (input.firstVisitAt !== undefined) {
      data.firstVisitAt = input.firstVisitAt ? requiredDate(input.firstVisitAt) : null;
    }
    if (input.invitedByMemberId !== undefined) {
      data.invitedByMember = input.invitedByMemberId
        ? { connect: { id: input.invitedByMemberId } }
        : { disconnect: true };
    }
    if (input.assignedToUserId !== undefined) data.assignedToUserId = input.assignedToUserId;
    if (input.addressLine1 !== undefined) data.addressLine1 = input.addressLine1;
    if (input.city !== undefined) data.city = input.city;
    if (input.countryCode !== undefined) data.countryCode = input.countryCode;
    if (input.interests !== undefined) data.interests = input.interests;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.followUpAt !== undefined) {
      data.followUpAt = input.followUpAt ? requiredDate(input.followUpAt) : null;
    }

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.visitor.update({ where: { id: visitorId }, data, include: VISITOR_INCLUDE }),
    );
    return toResponse(row);
  }

  /** Record a visit and fold it into the denormalized counters in one write. */
  async addVisit(
    tenantId: string,
    actorUserId: string,
    visitorId: string,
    input: VisitorVisitRequest,
  ): Promise<VisitorVisitResponse> {
    const visitor = await this.findRow(tenantId, visitorId);
    if (visitor.status === 'CONVERTED') {
      throw new DomainError(
        'VISITOR_ALREADY_CONVERTED',
        'This visitor has already become a member',
      );
    }

    const occurredAt = requiredDate(input.occurredAt);

    const visit = await this.prisma.withTenant(tenantId, (tx) =>
      tx.visitorVisit.create({
        data: {
          tenantId,
          visitorId,
          occurredAt,
          serviceName: input.serviceName ?? null,
          attended: input.attended,
          notes: input.notes ?? null,
          recordedByUserId: actorUserId,
        },
      }),
    );

    if (input.attended) {
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.visitor.update({
          where: { id: visitorId },
          data: {
            lastVisitAt: occurredAt,
            visitCount: { increment: 1 },
            firstVisitAt: visitor.firstVisitAt ?? occurredAt,
            ...(visitor.status === 'NEW' ? { status: 'RETURNING' } : {}),
          },
        }),
      );
    }

    return {
      id: visit.id,
      visitorId: visit.visitorId,
      occurredAt: toIso(visit.occurredAt) as string,
      serviceName: visit.serviceName ?? undefined,
      attended: visit.attended,
      notes: visit.notes ?? undefined,
      recordedByUserId: visit.recordedByUserId,
      createdAt: toIso(visit.createdAt) as string,
    };
  }

  /**
   * Conversion creates the member record and links the two, preserving the
   * visitor row so the follow-up history and the reason they came are not lost.
   */
  async convert(
    tenantId: string,
    actorUserId: string,
    visitorId: string,
    input: VisitorConvertRequest,
  ): Promise<VisitorResponse> {
    const visitor = await this.findRow(tenantId, visitorId);
    if (visitor.status === 'CONVERTED' || visitor.convertedMemberId) {
      throw new DomainError(
        'VISITOR_ALREADY_CONVERTED',
        'This visitor has already become a member',
      );
    }

    const override = input.member ?? {};
    const joinedAt = input.joinedAt ? new Date(input.joinedAt) : (visitor.firstVisitAt ?? new Date());

    const updated = await this.prisma.withTenant(tenantId, async (tx) => {
      const member = await tx.member.create({
        data: {
          tenantId,
          firstName: override.firstName ?? visitor.firstName,
          lastName: override.lastName ?? visitor.lastName,
          email: override.email ?? visitor.email,
          phone: override.phone ?? visitor.phone,
          addressLine1: override.addressLine1 ?? visitor.addressLine1,
          city: override.city ?? visitor.city,
          countryCode: override.countryCode ?? visitor.countryCode,
          status: 'ACTIVE',
          joinedAt,
          createdByUserId: actorUserId,
        },
      });

      await this.timeline.record(tx, {
        tenantId,
        memberId: member.id,
        type: 'CONVERSION',
        occurredAt: joinedAt,
        title: 'Became a member',
        summary: 'Converted from a first-time visitor',
        sourceResourceType: 'visitor',
        sourceResourceId: visitor.id,
        dedupeKey: `conversion:${visitor.id}`,
        createdByUserId: actorUserId,
      });

      return tx.visitor.update({
        where: { id: visitorId },
        data: {
          status: 'CONVERTED',
          convertedMemberId: member.id,
          convertedAt: new Date(),
        },
        include: VISITOR_INCLUDE,
      });
    });

    return toResponse(updated);
  }

  async assertExists(tenantId: string, visitorId: string): Promise<void> {
    await this.findRow(tenantId, visitorId);
  }

  private async findRow(tenantId: string, visitorId: string): Promise<VisitorWithVisits> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.visitor.findFirst({ where: { id: visitorId, tenantId }, include: VISITOR_INCLUDE }),
    );
    if (!row) throw new DomainError('VISITOR_NOT_FOUND', 'That visitor could not be found');
    return row;
  }

}

function toResponse(row: VisitorWithVisits): VisitorResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    status: row.status,
    source: row.source,
    firstVisitAt: toIso(row.firstVisitAt) ?? undefined,
    invitedByMemberId: row.invitedByMemberId ?? undefined,
    assignedToUserId: row.assignedToUserId ?? undefined,
    addressLine1: row.addressLine1 ?? undefined,
    city: row.city ?? undefined,
    countryCode: row.countryCode ?? undefined,
    interests: row.interests,
    notes: row.notes ?? undefined,
    followUpAt: toIso(row.followUpAt) ?? undefined,
    convertedMemberId: row.convertedMemberId,
    convertedAt: toIso(row.convertedAt),
    visits: row.visits.map((visit) => ({
      id: visit.id,
      visitorId: visit.visitorId,
      occurredAt: toIso(visit.occurredAt) as string,
      serviceName: visit.serviceName ?? undefined,
      attended: visit.attended,
      notes: visit.notes ?? undefined,
      recordedByUserId: visit.recordedByUserId,
      createdAt: toIso(visit.createdAt) as string,
    })),
    createdAt: toIso(row.createdAt) as string,
    updatedAt: toIso(row.updatedAt) as string,
  };
}
