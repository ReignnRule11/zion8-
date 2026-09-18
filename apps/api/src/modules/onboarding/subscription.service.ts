import { Injectable } from '@nestjs/common';
import { BillingCycle, Prisma, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import {
  PLAN_CATALOG,
  findPlan,
  priceForPlan,
  type PlanCatalogResponse,
  type SelectSubscriptionRequest,
  type SubscriptionSummary,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface SubscriptionRow {
  tenantId: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  seats: number | null;
  priceCents: number;
  currency: string;
  selectedByUserId: string | null;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  catalog(): PlanCatalogResponse {
    return { plans: [...PLAN_CATALOG], currency: PLAN_CATALOG[0]?.currency ?? 'USD' };
  }

  async get(tenantId: string): Promise<SubscriptionSummary | null> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantSubscription.findUnique({ where: { tenantId } }),
    );
    return row ? toSummary(row) : null;
  }

  /**
   * Applies the plan the owner chose. Idempotent: selecting the same plan again
   * refreshes the period without creating a second subscription, which is what
   * makes a double-submitted onboarding form harmless.
   */
  async select(
    tenantId: string,
    userId: string,
    input: SelectSubscriptionRequest,
  ): Promise<SubscriptionSummary> {
    const definition = findPlan(input.plan as SubscriptionPlan);
    if (!definition) throw DomainError.subscriptionPlanUnavailable();

    const seats = definition.seats === null ? null : Math.min(input.seats ?? definition.seats, definition.seats);
    if (input.seats !== undefined && definition.seats !== null && input.seats > definition.seats) {
      throw DomainError.validation([
        {
          path: 'seats',
          message: `The ${definition.name} plan supports at most ${definition.seats} members.`,
        },
      ]);
    }

    const { priceCents, currency } = priceForPlan(
      input.plan as SubscriptionPlan,
      input.billingCycle as BillingCycle,
    );
    const now = new Date();
    const trialEndsAt =
      definition.trialDays > 0 ? new Date(now.getTime() + definition.trialDays * 86_400_000) : null;
    const status =
      trialEndsAt !== null ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE;

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantSubscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          plan: input.plan as SubscriptionPlan,
          billingCycle: input.billingCycle as BillingCycle,
          status,
          seats,
          priceCents,
          currency,
          selectedByUserId: userId,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd(now, input.billingCycle as BillingCycle),
        },
        update: {
          plan: input.plan as SubscriptionPlan,
          billingCycle: input.billingCycle as BillingCycle,
          status,
          seats,
          priceCents,
          currency,
          selectedByUserId: userId,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd(now, input.billingCycle as BillingCycle),
          canceledAt: null,
        },
      }),
    );

    return toSummary(row);
  }

  /**
   * Places a brand-new workspace on the free plan so that provisioning can
   * complete unattended. The owner can change it during onboarding or later.
   */
  async seedDefault(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<void> {
    const existing = await tx.tenantSubscription.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (existing) return;

    const definition = findPlan(SubscriptionPlan.FREE);
    await tx.tenantSubscription.create({
      data: {
        tenantId,
        plan: SubscriptionPlan.FREE,
        billingCycle: BillingCycle.MONTHLY,
        status: SubscriptionStatus.ACTIVE,
        seats: definition?.seats ?? null,
        priceCents: 0,
        currency: definition?.currency ?? 'USD',
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
      },
    });
  }
}

function periodEnd(start: Date, cycle: BillingCycle): Date {
  const end = new Date(start);
  if (cycle === BillingCycle.ANNUAL) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

export function toSummary(row: SubscriptionRow): SubscriptionSummary {
  return {
    tenantId: row.tenantId,
    plan: row.plan,
    billingCycle: row.billingCycle,
    status: row.status,
    seats: row.seats,
    priceCents: row.priceCents,
    currency: row.currency,
    selectedByUserId: row.selectedByUserId,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodStart: row.currentPeriodStart.toISOString(),
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    canceledAt: row.canceledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
