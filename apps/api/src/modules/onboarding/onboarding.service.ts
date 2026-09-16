import { Injectable } from '@nestjs/common';
import {
  MembershipStatus,
  OnboardingStatus,
  OnboardingStep,
  OnboardingStepStatus,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';
import {
  ONBOARDING_REQUIRED_STEPS,
  ONBOARDING_STEP_ORDER,
  isOnboardingStepRequired,
  type OnboardingState,
  type OnboardingStepState,
  type OnboardingSummary,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubscriptionService } from './subscription.service';

const TOTAL_STEPS = ONBOARDING_STEP_ORDER.length;
const COMPLETE_STATUSES: readonly OnboardingStepStatus[] = [
  OnboardingStepStatus.COMPLETED,
  OnboardingStepStatus.SKIPPED,
];

export interface ReconcileFacts {
  registrationComplete: boolean;
  emailVerified: boolean;
  provisioningComplete: boolean;
  workspaceComplete: boolean;
  invitationComplete: boolean;
  subscriptionComplete: boolean;
  brandingComplete: boolean;
  memberImportComplete: boolean;
}

/**
 * Owns the church onboarding journey.
 *
 * The journey is a projection of what is actually true about the workspace, not
 * a script the client is trusted to follow. Every read recomputes the step
 * statuses from persisted facts and repairs anything that drifted, and side
 * effects such as provisioning are idempotent. That is what lets a user close
 * the tab, retry a failed step, or resume days later without the journey
 * getting stuck or skipping ahead.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly logger: AppLogger,
  ) {}

  /** Returns the current journey, reconciling and materializing it first. */
  async getState(tenantId: string): Promise<OnboardingState> {
    return this.reconcile(tenantId);
  }

  /**
   * Best-effort reconciliation for the workspace a user owns. Called after
   * registration and email verification so the journey reflects reality
   * immediately, without registration having to know a tenant id. A user who
   * does not own a workspace yet is simply skipped.
   */
  async reconcileForUser(userId: string): Promise<void> {
    const membership = await this.prisma.withScope({ userId, isPlatformAdmin: true }, (tx) =>
      tx.membership.findFirst({
        where: { userId, role: Role.CHURCH_OWNER },
        select: { tenantId: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
    if (!membership) return;

    try {
      await this.reconcile(membership.tenantId);
    } catch (error) {
      this.logger.warn(
        `Onboarding reconciliation failed for user ${userId}: ${messageOf(error)}`,
        'OnboardingService',
      );
    }
  }

  /**
   * Recomputes the journey inside a single transaction. Provisioning is a side
   * effect of reaching a verified workspace, so it runs here rather than being
   * a step the client can forget.
   */
  async reconcile(tenantId: string): Promise<OnboardingState> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      await this.ensureJourney(tx, tenantId);

      const facts = await this.gatherFacts(tx, tenantId);

      if (facts.registrationComplete && facts.emailVerified && !facts.provisioningComplete) {
        try {
          await this.subscriptions.seedDefault(tx, tenantId);
          facts.provisioningComplete = true;
          await this.markStep(tx, tenantId, OnboardingStep.TENANT_PROVISIONING, {
            status: OnboardingStepStatus.COMPLETED,
            metadata: { source: 'provisioning' },
            incrementAttempt: true,
          });
        } catch (error) {
          facts.provisioningComplete = false;
          await this.markStep(tx, tenantId, OnboardingStep.TENANT_PROVISIONING, {
            status: OnboardingStepStatus.FAILED,
            lastError: messageOf(error),
            incrementAttempt: true,
          });
          this.logger.warn(
            `Provisioning failed for tenant ${tenantId}: ${messageOf(error)}`,
            'OnboardingService',
          );
        }
      }

      await this.applyFacts(tx, tenantId, facts);
      return this.readState(tx, tenantId, facts);
    });
  }

  /**
   * Guards a step handler. A caller can only touch a step once every earlier
   * *required* step is complete, which keeps the API honest even if a client
   * drives it out of order.
   */
  async assertReachable(tenantId: string, step: OnboardingStep): Promise<OnboardingState> {
    const state = await this.reconcile(tenantId);
    const targetIndex = ONBOARDING_STEP_ORDER.indexOf(step);

    const missing = state.steps.filter((entry) => {
      const index = ONBOARDING_STEP_ORDER.indexOf(entry.step);
      return index < targetIndex && entry.required && entry.status !== 'COMPLETED';
    });

    if (missing.length > 0) {
      throw DomainError.onboardingStepOutOfOrder(missing.map((entry) => entry.step));
    }

    return state;
  }

  async skipStep(tenantId: string, step: OnboardingStep): Promise<OnboardingState> {
    if (isOnboardingStepRequired(step)) {
      throw DomainError.onboardingStepOutOfOrder([step], 'This step is required and cannot be skipped');
    }

    await this.assertReachable(tenantId, step);

    await this.prisma.withTenant(tenantId, async (tx) => {
      const current = await tx.tenantOnboarding.findUnique({ where: { tenantId } });
      if (current?.status === OnboardingStatus.COMPLETED) {
        throw DomainError.onboardingAlreadyCompleted();
      }
      await this.markStep(tx, tenantId, step, {
        status: OnboardingStepStatus.SKIPPED,
        metadata: { source: 'user' },
      });
    });

    return this.reconcile(tenantId);
  }

  async retryStep(tenantId: string, step: OnboardingStep): Promise<OnboardingState> {
    await this.prisma.withTenant(tenantId, (tx) =>
      this.markStep(tx, tenantId, step, {
        status: OnboardingStepStatus.PENDING,
        resetError: true,
        incrementAttempt: true,
      }),
    );
    return this.reconcile(tenantId);
  }

  async complete(tenantId: string): Promise<OnboardingState> {
    const state = await this.reconcile(tenantId);
    if (state.status === 'COMPLETED') return state;

    const missing = state.requiredStepsRemaining;
    if (missing.length > 0) throw DomainError.onboardingIncomplete(missing);

    await this.prisma.withTenant(tenantId, async (tx) => {
      await this.markStep(tx, tenantId, OnboardingStep.DASHBOARD_READY, {
        status: OnboardingStepStatus.COMPLETED,
        metadata: { source: 'user' },
      });
      await tx.tenantOnboarding.update({
        where: { tenantId },
        data: {
          status: OnboardingStatus.COMPLETED,
          completedAt: new Date(),
          currentStep: OnboardingStep.DASHBOARD_READY,
          lastActivityAt: new Date(),
        },
      });
    });

    return this.reconcile(tenantId);
  }

  async summary(tenantId: string): Promise<OnboardingSummary> {
    const state = await this.reconcile(tenantId);
    return {
      status: state.status,
      currentStep: state.currentStep,
      percentComplete: state.percentComplete,
      completed: state.status === 'COMPLETED',
    };
  }

  /** Records an activity timestamp so staleness is observable. */
  async touch(tenantId: string): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantOnboarding.updateMany({
        where: { tenantId },
        data: { lastActivityAt: new Date() },
      }),
    );
  }

  private async ensureJourney(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const existing = await tx.tenantOnboarding.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    if (!existing) {
      await tx.tenantOnboarding.create({ data: { tenantId } });
    }

    await tx.tenantOnboardingStep.createMany({
      data: ONBOARDING_STEP_ORDER.map((step) => ({ tenantId, step })),
      skipDuplicates: true,
    });
  }

  private async gatherFacts(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<ReconcileFacts> {
    const owner = await this.ownerUser(tx, tenantId);
    const [subscription, branding, workspace, invitationCount, memberImport, memberCount] =
      await Promise.all([
        tx.tenantSubscription.findUnique({ where: { tenantId }, select: { id: true } }),
        tx.brandTheme.findUnique({ where: { tenantId }, select: { id: true } }),
        tx.churchProfile.findUnique({ where: { tenantId }, select: { id: true } }),
        tx.tenantInvitation.count({ where: { tenantId } }),
        tx.memberImportJob.count({ where: { tenantId, status: 'COMPLETED' } }),
        tx.membership.count({ where: { tenantId, status: MembershipStatus.ACTIVE } }),
      ]);

    return {
      registrationComplete: owner !== null,
      emailVerified: owner?.emailVerifiedAt !== null && owner !== null,
      provisioningComplete: subscription !== null,
      workspaceComplete: workspace !== null,
      invitationComplete: invitationCount > 0,
      subscriptionComplete: subscription !== null,
      brandingComplete: branding !== null,
      memberImportComplete: memberImport > 0 || memberCount > 1,
    };
  }

  /**
   * Writes the derived statuses back. Required steps are always truth-driven;
   * optional steps only transition forward, so a deliberate SKIPPED is never
   * undone by reconciliation.
   */
  private async applyFacts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    facts: ReconcileFacts,
  ): Promise<void> {
    const desired: Array<[OnboardingStep, boolean]> = [
      [OnboardingStep.REGISTRATION, facts.registrationComplete],
      [OnboardingStep.EMAIL_VERIFICATION, facts.emailVerified],
      [OnboardingStep.TENANT_PROVISIONING, facts.provisioningComplete],
      [OnboardingStep.WORKSPACE_CREATION, facts.workspaceComplete],
      [OnboardingStep.ADMINISTRATOR_INVITATION, facts.invitationComplete],
      [OnboardingStep.SUBSCRIPTION_SELECTION, facts.subscriptionComplete],
      [OnboardingStep.BRAND_CUSTOMIZATION, facts.brandingComplete],
      [OnboardingStep.FIRST_MEMBER_IMPORT, facts.memberImportComplete],
    ];

    const steps = await tx.tenantOnboardingStep.findMany({ where: { tenantId } });
    const byStep = new Map(steps.map((entry) => [entry.step, entry]));

    for (const [step, complete] of desired) {
      const entry = byStep.get(step);
      if (!entry || !complete) continue;
      if (COMPLETE_STATUSES.includes(entry.status)) continue;
      await this.markStep(tx, tenantId, step, {
        status: OnboardingStepStatus.COMPLETED,
        metadata: { source: 'reconciled' },
      });
    }

    const refreshed = await tx.tenantOnboardingStep.findMany({ where: { tenantId } });
    const next = ONBOARDING_STEP_ORDER.find((step) => {
      const entry = refreshed.find((candidate) => candidate.step === step);
      return !entry || !COMPLETE_STATUSES.includes(entry.status);
    });
    const currentStep = next ?? OnboardingStep.DASHBOARD_READY;
    const completedCount = refreshed.filter((entry) =>
      COMPLETE_STATUSES.includes(entry.status),
    ).length;

    await tx.tenantOnboarding.update({
      where: { tenantId },
      data: { currentStep, lastActivityAt: new Date() },
    });

    if (completedCount === TOTAL_STEPS) {
      const onboarding = await tx.tenantOnboarding.findUnique({
        where: { tenantId },
        select: { status: true },
      });
      if (onboarding?.status !== OnboardingStatus.COMPLETED) {
        await tx.tenantOnboarding.update({
          where: { tenantId },
          data: { status: OnboardingStatus.COMPLETED, completedAt: new Date() },
        });
      }
    }
  }

  private async readState(
    tx: Prisma.TransactionClient,
    tenantId: string,
    facts: ReconcileFacts,
  ): Promise<OnboardingState> {
    const [onboarding, steps, tenant] = await Promise.all([
      tx.tenantOnboarding.findUniqueOrThrow({ where: { tenantId } }),
      tx.tenantOnboardingStep.findMany({ where: { tenantId } }),
      tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true, slug: true },
      }),
    ]);

    const ordered = ONBOARDING_STEP_ORDER.map((step) => {
      const entry = steps.find((candidate) => candidate.step === step);
      return toStepState(step, entry);
    });

    const completedCount = ordered.filter((entry) =>
      COMPLETE_STATUSES.includes(entry.status as OnboardingStepStatus),
    ).length;

    return {
      tenantId,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      status: onboarding.status,
      currentStep: onboarding.currentStep,
      percentComplete: Math.round((completedCount / TOTAL_STEPS) * 100),
      requiredStepsRemaining: ordered
        .filter((entry) => entry.required && entry.status !== 'COMPLETED')
        .map((entry) => entry.step),
      steps: ordered,
      emailVerified: facts.emailVerified,
      startedAt: onboarding.startedAt.toISOString(),
      completedAt: onboarding.completedAt?.toISOString() ?? null,
      lastActivityAt: onboarding.lastActivityAt.toISOString(),
    };
  }

  private async ownerUser(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<{ id: string; emailVerifiedAt: Date | null } | null> {
    const membership = await tx.membership.findFirst({
      where: { tenantId, role: Role.CHURCH_OWNER },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) return null;

    const user = await tx.user.findUnique({
      where: { id: membership.userId },
      select: { id: true, emailVerifiedAt: true, status: true },
    });
    if (!user || user.status === UserStatus.DISABLED) return null;
    return { id: user.id, emailVerifiedAt: user.emailVerifiedAt };
  }

  private async markStep(
    tx: Prisma.TransactionClient,
    tenantId: string,
    step: OnboardingStep,
    options: {
      status: OnboardingStepStatus;
      metadata?: Prisma.InputJsonValue;
      lastError?: string | null;
      resetError?: boolean;
      incrementAttempt?: boolean;
    },
  ): Promise<void> {
    await tx.tenantOnboardingStep.update({
      where: { tenantId_step: { tenantId, step } },
      data: {
        status: options.status,
        ...(options.incrementAttempt ? { attemptCount: { increment: 1 } } : {}),
        ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
        ...(options.resetError ? { lastError: null } : {}),
        ...(options.lastError !== undefined ? { lastError: options.lastError } : {}),
        ...(options.status === OnboardingStepStatus.COMPLETED
          ? { completedAt: new Date() }
          : { completedAt: null }),
        ...(options.status === OnboardingStepStatus.IN_PROGRESS ? { startedAt: new Date() } : {}),
      },
    });
  }
}

function toStepState(
  step: OnboardingStep,
  entry:
    | {
        status: OnboardingStepStatus;
        attemptCount: number;
        lastError: string | null;
        metadata: Prisma.JsonValue;
        startedAt: Date | null;
        completedAt: Date | null;
      }
    | undefined,
): OnboardingStepState {
  return {
    step,
    status: entry?.status ?? 'PENDING',
    required: ONBOARDING_REQUIRED_STEPS.includes(step),
    attemptCount: entry?.attemptCount ?? 0,
    lastError: entry?.lastError ?? null,
    metadata:
      entry?.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
        ? (entry.metadata as Record<string, unknown>)
        : {},
    startedAt: entry?.startedAt?.toISOString() ?? null,
    completedAt: entry?.completedAt?.toISOString() ?? null,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
