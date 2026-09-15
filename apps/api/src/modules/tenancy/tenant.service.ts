import { Injectable } from '@nestjs/common';
import { Prisma, TenantStatus, MembershipStatus } from '@prisma/client';
import type { Role } from '@zion8/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain-error';

export interface MembershipView {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: Role;
  status: MembershipStatus;
  createdAt: Date;
}

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async slugExists(slug: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    const client = tx ?? this.prisma;
    const tenant = await client.tenant.findUnique({ where: { slug }, select: { id: true } });
    return tenant !== null;
  }

  async requireActiveTenant(
    slug: string,
  ): Promise<{ id: string; slug: string; status: TenantStatus }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, status: true },
    });
    if (!tenant) throw DomainError.tenantNotFound();
    if (tenant.status !== TenantStatus.ACTIVE) throw DomainError.tenantSuspended();
    return tenant;
  }

  async createTenant(
    tx: Prisma.TransactionClient,
    input: { name: string; slug: string; timezone: string; locale: string },
  ): Promise<{ id: string; slug: string; name: string; status: TenantStatus; createdAt: Date }> {
    return tx.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        locale: input.locale,
      },
      select: { id: true, slug: true, name: true, status: true, createdAt: true },
    });
  }

  async createMembership(
    tx: Prisma.TransactionClient,
    input: { tenantId: string; userId: string; role: Role; status?: MembershipStatus },
  ): Promise<{ id: string }> {
    return tx.membership.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        role: input.role,
        status: input.status ?? MembershipStatus.ACTIVE,
      },
      select: { id: true },
    });
  }

  async findActiveMembership(
    userId: string,
    tenantId: string,
  ): Promise<{ id: string; role: Role; status: MembershipStatus } | null> {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { id: true, role: true, status: true },
      }),
    );
  }

  async listMembershipsForUser(userId: string): Promise<MembershipView[]> {
    const memberships = await this.prisma.withScope({ userId }, (tx) =>
      tx.membership.findMany({
        where: { userId },
        select: {
          id: true,
          tenantId: true,
          role: true,
          status: true,
          createdAt: true,
          tenant: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    return memberships.map((membership) => ({
      id: membership.id,
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      tenantSlug: membership.tenant.slug,
      role: membership.role as Role,
      status: membership.status,
      createdAt: membership.createdAt,
    }));
  }

  async resolveTenantForLogin(
    userId: string,
    requestedSlug?: string,
  ): Promise<{ tenantId: string | null; role: Role | null; memberships: MembershipView[] }> {
    const memberships = await this.listMembershipsForUser(userId);
    const active = memberships.filter(
      (membership) => membership.status === MembershipStatus.ACTIVE,
    );

    if (requestedSlug) {
      const match = active.find((membership) => membership.tenantSlug === requestedSlug);
      if (!match) throw DomainError.membershipRequired();
      return { tenantId: match.tenantId, role: match.role, memberships };
    }

    if (active.length === 1) {
      const only = active[0]!;
      return { tenantId: only.tenantId, role: only.role, memberships };
    }

    if (active.length === 0) {
      return { tenantId: null, role: null, memberships };
    }

    return { tenantId: null, role: null, memberships };
  }
}
