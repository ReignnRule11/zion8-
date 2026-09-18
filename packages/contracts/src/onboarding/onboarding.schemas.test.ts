import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_REQUIRED_STEPS,
  ONBOARDING_STEP_ORDER,
  isOnboardingStepRequired,
  onboardingStepSchema,
} from './onboarding.schemas';
import { PLAN_CATALOG, findPlan, priceForPlan } from './subscription.schemas';
import { brandThemeSchema } from './branding.schemas';
import { memberImportPreviewSchema } from './member-import.schemas';

describe('onboarding step order', () => {
  it('covers every step exactly once', () => {
    expect(new Set(ONBOARDING_STEP_ORDER).size).toBe(ONBOARDING_STEP_ORDER.length);
    expect(ONBOARDING_STEP_ORDER.every((step) => onboardingStepSchema.safeParse(step).success)).toBe(
      true,
    );
  });

  it('treats registration through workspace creation as required', () => {
    expect(isOnboardingStepRequired('REGISTRATION')).toBe(true);
    expect(isOnboardingStepRequired('WORKSPACE_CREATION')).toBe(true);
    expect(isOnboardingStepRequired('BRAND_CUSTOMIZATION')).toBe(false);
    expect(ONBOARDING_REQUIRED_STEPS).toHaveLength(4);
  });
});

describe('subscription plan catalogue', () => {
  it('has a free entry level plan', () => {
    const free = findPlan('FREE');
    expect(free?.monthlyPriceCents).toBe(0);
    expect(free?.annualPriceCents).toBe(0);
  });

  it('prices annual plans as ten months', () => {
    for (const plan of PLAN_CATALOG) {
      if (plan.monthlyPriceCents === 0) continue;
      expect(plan.annualPriceCents).toBe(plan.monthlyPriceCents * 10);
    }
  });

  it('resolves the price for a cycle', () => {
    expect(priceForPlan('STANDARD', 'MONTHLY')).toEqual({ priceCents: 3900, currency: 'USD' });
    expect(priceForPlan('STANDARD', 'ANNUAL')).toEqual({ priceCents: 39000, currency: 'USD' });
  });

  it('marks exactly one plan as recommended', () => {
    expect(PLAN_CATALOG.filter((plan) => plan.recommended)).toHaveLength(1);
  });
});

describe('brand theme validation', () => {
  it('applies default colours', () => {
    const theme = brandThemeSchema.parse({});
    expect(theme.primaryColor).toBe('#4f46e5');
    expect(theme.accentColor).toBe('#38bdf8');
  });

  it('rejects malformed colours and normalizes case', () => {
    expect(brandThemeSchema.safeParse({ primaryColor: 'indigo' }).success).toBe(false);
    expect(brandThemeSchema.parse({ primaryColor: '#ABCDEF' }).primaryColor).toBe('#abcdef');
  });

  it('accepts a bare hostname and rejects a full URL', () => {
    expect(brandThemeSchema.safeParse({ customDomain: 'gracechapel.org' }).success).toBe(true);
    expect(brandThemeSchema.safeParse({ customDomain: 'https://gracechapel.org' }).success).toBe(
      false,
    );
  });
});

describe('member import preview request', () => {
  it('accepts a CSV document', () => {
    expect(memberImportPreviewSchema.safeParse({ csv: 'first_name,last_name\nA,B' }).success).toBe(
      true,
    );
  });

  it('accepts an array of rows', () => {
    expect(memberImportPreviewSchema.safeParse({ rows: [{ firstName: 'A', lastName: 'B' }] }).success).toBe(
      true,
    );
  });

  it('requires at least one source', () => {
    expect(memberImportPreviewSchema.safeParse({}).success).toBe(false);
  });
});
