import { z } from 'zod';
import { uuidSchema } from '../common/primitives';

/**
 * The ordered steps a church workspace moves through after registration.
 *
 * The order here is the canonical order: it drives the stepper in the UI, the
 * "next step" computation, and the precondition checks that stop a caller from
 * jumping ahead. Persisted step rows are keyed by (tenantId, step) so the
 * journey is resumable after a crash, a closed tab, or a failed request.
 */
export const OnboardingStep = {
  REGISTRATION: 'REGISTRATION',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  TENANT_PROVISIONING: 'TENANT_PROVISIONING',
  WORKSPACE_CREATION: 'WORKSPACE_CREATION',
  ADMINISTRATOR_INVITATION: 'ADMINISTRATOR_INVITATION',
  SUBSCRIPTION_SELECTION: 'SUBSCRIPTION_SELECTION',
  BRAND_CUSTOMIZATION: 'BRAND_CUSTOMIZATION',
  FIRST_MEMBER_IMPORT: 'FIRST_MEMBER_IMPORT',
  DASHBOARD_READY: 'DASHBOARD_READY',
} as const;

export type OnboardingStep = (typeof OnboardingStep)[keyof typeof OnboardingStep];

export const onboardingStepSchema = z.enum(
  Object.values(OnboardingStep) as [OnboardingStep, ...OnboardingStep[]],
);

/** Canonical execution order of the onboarding steps. */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStep[] = [
  OnboardingStep.REGISTRATION,
  OnboardingStep.EMAIL_VERIFICATION,
  OnboardingStep.TENANT_PROVISIONING,
  OnboardingStep.WORKSPACE_CREATION,
  OnboardingStep.ADMINISTRATOR_INVITATION,
  OnboardingStep.SUBSCRIPTION_SELECTION,
  OnboardingStep.BRAND_CUSTOMIZATION,
  OnboardingStep.FIRST_MEMBER_IMPORT,
  OnboardingStep.DASHBOARD_READY,
];

/**
 * Steps a workspace must finish before the dashboard unlocks. The remaining
 * steps are genuinely optional and can be completed later from settings.
 */
export const ONBOARDING_REQUIRED_STEPS: readonly OnboardingStep[] = [
  OnboardingStep.REGISTRATION,
  OnboardingStep.EMAIL_VERIFICATION,
  OnboardingStep.TENANT_PROVISIONING,
  OnboardingStep.WORKSPACE_CREATION,
];

export function isOnboardingStepRequired(step: OnboardingStep): boolean {
  return ONBOARDING_REQUIRED_STEPS.includes(step);
}

export const OnboardingStepStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
} as const;

export type OnboardingStepStatus =
  (typeof OnboardingStepStatus)[keyof typeof OnboardingStepStatus];

export const onboardingStepStatusSchema = z.enum(
  Object.values(OnboardingStepStatus) as [OnboardingStepStatus, ...OnboardingStepStatus[]],
);

export const onboardingStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']);

export const onboardingStepStateSchema = z.object({
  step: onboardingStepSchema,
  status: onboardingStepStatusSchema,
  required: z.boolean(),
  attemptCount: z.number().int().min(0),
  lastError: z.string().nullable(),
  metadata: z.record(z.unknown()),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export type OnboardingStepState = z.infer<typeof onboardingStepStateSchema>;

export const onboardingStateSchema = z.object({
  tenantId: uuidSchema,
  tenantSlug: z.string(),
  tenantName: z.string(),
  status: onboardingStatusSchema,
  currentStep: onboardingStepSchema,
  percentComplete: z.number().int().min(0).max(100),
  requiredStepsRemaining: z.array(onboardingStepSchema),
  steps: z.array(onboardingStepStateSchema),
  emailVerified: z.boolean(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  lastActivityAt: z.string().datetime(),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

/** A lightweight projection used by dashboards and the sign-in redirect. */
export const onboardingSummarySchema = z.object({
  status: onboardingStatusSchema,
  currentStep: onboardingStepSchema,
  percentComplete: z.number().int().min(0).max(100),
  completed: z.boolean(),
});

export type OnboardingSummary = z.infer<typeof onboardingSummarySchema>;

export const completeOnboardingSchema = z.object({
  acknowledgeOptionalSteps: z.boolean().default(false),
});

export type CompleteOnboardingRequest = z.infer<typeof completeOnboardingSchema>;
