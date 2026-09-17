import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ChurchProfileRequest, ChurchProfileResponse, ServiceTime } from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<ChurchProfileResponse | null> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.churchProfile.findUnique({ where: { tenantId } }),
    );
    return row ? toResponse(row) : null;
  }

  /**
   * Upsert rather than insert: the owner may revisit the workspace step, and a
   * resubmitted form must update the same profile instead of failing on the
   * unique tenant constraint.
   */
  async save(tenantId: string, input: ChurchProfileRequest): Promise<ChurchProfileResponse> {
    validateServiceTimes(input.serviceTimes);

    const data = {
      legalName: input.legalName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      websiteUrl: input.websiteUrl ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      postalCode: input.postalCode ?? null,
      countryCode: input.countryCode ?? null,
      currency: input.currency,
      weekStart: input.weekStart,
      estimatedMembers: input.estimatedMembers ?? null,
      serviceTimes: input.serviceTimes as unknown as Prisma.InputJsonValue,
    };

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.churchProfile.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      }),
    );

    return toResponse(row);
  }
}

function validateServiceTimes(serviceTimes: ServiceTime[]): void {
  const details = serviceTimes
    .map((service, index) => {
      if (service.endTime && service.endTime <= service.startTime) {
        return {
          path: `serviceTimes.${index}.endTime`,
          message: 'The end time must be after the start time.',
        };
      }
      return null;
    })
    .filter((issue): issue is { path: string; message: string } => issue !== null);

  if (details.length > 0) throw DomainError.validation(details);
}

interface ChurchProfileRow {
  tenantId: string;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  currency: string;
  weekStart: string;
  estimatedMembers: number | null;
  serviceTimes: Prisma.JsonValue;
  completedAt: Date;
  updatedAt: Date;
}

function toResponse(row: ChurchProfileRow): ChurchProfileResponse {
  return {
    tenantId: row.tenantId,
    legalName: row.legalName ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    contactPhone: row.contactPhone ?? undefined,
    websiteUrl: row.websiteUrl ?? undefined,
    addressLine1: row.addressLine1 ?? undefined,
    addressLine2: row.addressLine2 ?? undefined,
    city: row.city ?? undefined,
    region: row.region ?? undefined,
    postalCode: row.postalCode ?? undefined,
    countryCode: row.countryCode ?? undefined,
    currency: row.currency,
    weekStart: row.weekStart as ChurchProfileResponse['weekStart'],
    estimatedMembers: row.estimatedMembers ?? undefined,
    serviceTimes: Array.isArray(row.serviceTimes)
      ? (row.serviceTimes as unknown as ServiceTime[])
      : [],
    completedAt: row.completedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
