import { z } from 'zod';
import { uuidSchema } from '../common/primitives';

/**
 * Subscription selection. Pricing lives in the contract so that the web and
 * mobile clients render the same catalogue the API enforces; the API remains
 * the authority and re-validates every selection against this catalogue.
 */

export const SubscriptionPlan = {
  FREE: 'FREE',
  STANDARD: 'STANDARD',
  GROWTH: 'GROWTH',
  MULTISITE: 'MULTISITE',
} as const;

export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const subscriptionPlanSchema = z.enum(
  Object.values(SubscriptionPlan) as [SubscriptionPlan, ...SubscriptionPlan[]],
);

export const BillingCycle = {
  MONTHLY: 'MONTHLY',
  ANNUAL: 'ANNUAL',
} as const;

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const billingCycleSchema = z.enum(
  Object.values(BillingCycle) as [BillingCycle, ...BillingCycle[]],
);

/** Seats are `null` when the plan is not seat-limited. */
export const planDefinitionSchema = z.object({
  plan: subscriptionPlanSchema,
  name: z.string(),
  description: z.string(),
  seats: z.number().int().positive().nullable(),
  monthlyPriceCents: z.number().int().min(0),
  annualPriceCents: z.number().int().min(0),
  currency: z.string().length(3),
  trialDays: z.number().int().min(0),
  features: z.array(z.string()),
  recommended: z.boolean(),
});

export type PlanDefinition = z.infer<typeof planDefinitionSchema>;

/**
 * The catalogue the API enforces and every client renders. Prices are in minor
 * units of `currency`. Seats are `null` for plans that are not seat-limited.
 */
export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    plan: SubscriptionPlan.FREE,
    name: 'Foundation',
    description: 'For church plants and small congregations finding their feet.',
    seats: 50,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    currency: 'USD',
    trialDays: 0,
    features: [
      'Up to 50 members',
      'Membership and attendance',
      'Events and ministries',
      'Prayer requests',
      'Sermon archive',
    ],
    recommended: false,
  },
  {
    plan: SubscriptionPlan.STANDARD,
    name: 'Standard',
    description: 'For established congregations running weekly ministry operations.',
    seats: 500,
    monthlyPriceCents: 3900,
    annualPriceCents: 39000,
    currency: 'USD',
    trialDays: 14,
    features: [
      'Up to 500 members',
      'Giving and contribution records',
      'Volunteer scheduling',
      'Website builder',
      'AI memory search',
    ],
    recommended: true,
  },
  {
    plan: SubscriptionPlan.GROWTH,
    name: 'Growth',
    description: 'For growing churches with multiple ministries and finance teams.',
    seats: 2500,
    monthlyPriceCents: 9900,
    annualPriceCents: 99000,
    currency: 'USD',
    trialDays: 14,
    features: [
      'Up to 2,500 members',
      'Accounting and period close',
      'Counseling case management',
      'Advanced analytics',
      'Priority support',
    ],
    recommended: false,
  },
  {
    plan: SubscriptionPlan.MULTISITE,
    name: 'Multisite',
    description: 'For multi-campus churches and dioceses with central oversight.',
    seats: null,
    monthlyPriceCents: 24900,
    annualPriceCents: 249000,
    currency: 'USD',
    trialDays: 30,
    features: [
      'Unlimited members',
      'Multiple campuses and sites',
      'Cross-site roll-up reporting',
      'Dedicated success manager',
      'Custom data residency',
    ],
    recommended: false,
  },
];

export function findPlan(plan: SubscriptionPlan): PlanDefinition | undefined {
  return PLAN_CATALOG.find((definition) => definition.plan === plan);
}

export function priceForPlan(
  plan: SubscriptionPlan,
  billingCycle: BillingCycle,
): { priceCents: number; currency: string } {
  const definition = findPlan(plan);
  if (!definition) throw new Error(`Unknown subscription plan: ${plan}`);
  return {
    priceCents:
      billingCycle === BillingCycle.ANNUAL
        ? definition.annualPriceCents
        : definition.monthlyPriceCents,
    currency: definition.currency,
  };
}

export const planCatalogResponseSchema = z.object({
  plans: z.array(planDefinitionSchema),
  currency: z.string().length(3),
});

export type PlanCatalogResponse = z.infer<typeof planCatalogResponseSchema>;

export const selectSubscriptionSchema = z.object({
  plan: subscriptionPlanSchema,
  billingCycle: billingCycleSchema.default('MONTHLY'),
  seats: z.number().int().min(1).max(100_000).optional(),
});

export type SelectSubscriptionRequest = z.infer<typeof selectSubscriptionSchema>;

export const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const subscriptionStatusSchema = z.enum(
  Object.values(SubscriptionStatus) as [SubscriptionStatus, ...SubscriptionStatus[]],
);

export const subscriptionSummarySchema = z.object({
  tenantId: uuidSchema,
  plan: subscriptionPlanSchema,
  billingCycle: billingCycleSchema,
  status: subscriptionStatusSchema,
  seats: z.number().int().positive().nullable(),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3),
  selectedByUserId: uuidSchema.nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime().nullable(),
  canceledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SubscriptionSummary = z.infer<typeof subscriptionSummarySchema>;
