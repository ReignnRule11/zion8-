import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ONBOARDING_STEP_ORDER,
  onboardingStepSchema,
  type OnboardingState,
  type OnboardingStep,
} from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { STEP_DESCRIPTION, STEP_LABEL } from '@/components/onboarding/steps';
import { StepStatusBadge, hintClass } from '@/components/onboarding/ui';
import { WorkspaceForm } from '@/components/onboarding/workspace-form';
import { BrandingForm } from '@/components/onboarding/branding-form';
import { SubscriptionSelector } from '@/components/onboarding/subscription-selector';
import { InvitationManager } from '@/components/onboarding/invitation-manager';
import { MemberImportForm } from '@/components/onboarding/member-import-form';
import { SignOutButton } from '@/components/sign-out-button';
import { completeOnboardingAction, retryStepAction, skipStepAction } from './actions';

export const metadata: Metadata = { title: 'Set up your church' };
export const dynamic = 'force-dynamic';

const INFORMATIONAL_STEPS: OnboardingStep[] = [
  'REGISTRATION',
  'EMAIL_VERIFICATION',
  'TENANT_PROVISIONING',
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const token = await getAccessToken();
  if (!token) redirect('/sign-in');

  let state: OnboardingState;
  try {
    state = await api.getOnboarding(token);
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) redirect('/sign-in');
    throw error;
  }

  const { step } = await searchParams;
  const requested = step ? onboardingStepSchema.safeParse(step.toUpperCase()) : null;
  const activeStep: OnboardingStep = requested?.success ? requested.data : state.currentStep;

  const activeIndex = ONBOARDING_STEP_ORDER.indexOf(activeStep);
  const activeEntry = state.steps.find((entry) => entry.step === activeStep);
  const missingEarlier = state.steps.filter((entry) => {
    const index = ONBOARDING_STEP_ORDER.indexOf(entry.step);
    return index < activeIndex && entry.required && entry.status !== 'COMPLETED';
  });
  const reachable = missingEarlier.length === 0;
  const isOptional = activeEntry ? !activeEntry.required : false;
  const isDashboard = activeStep === 'DASHBOARD_READY';
  const canFinish = state.requiredStepsRemaining.length === 0;
  const nextStep: OnboardingStep | undefined =
    activeIndex >= 0 && activeIndex < ONBOARDING_STEP_ORDER.length - 1
      ? ONBOARDING_STEP_ORDER[activeIndex + 1]
      : undefined;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Zion<span className="text-zion-400">8</span>
          </Link>
          <p className="text-sm text-slate-400">
            {state.tenantName} · /{state.tenantSlug}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Set up your church</h1>
            <p className="mt-1 text-sm text-slate-400">
              {state.status === 'COMPLETED'
                ? 'Onboarding is complete. You can revisit any step at any time.'
                : `${state.percentComplete}% complete · ${state.steps.filter((entry) => entry.status === 'COMPLETED' || entry.status === 'SKIPPED').length} of ${state.steps.length} steps done`}
            </p>
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
            <div
              className="bg-zion-500 h-full rounded-full transition-all"
              style={{ width: `${state.percentComplete}%` }}
            />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[20rem_1fr]">
        <nav aria-label="Onboarding steps">
          <OnboardingStepper state={state} activeStep={activeStep} />
        </nav>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{STEP_LABEL[activeStep]}</h2>
                {activeEntry ? <StepStatusBadge status={activeEntry.status} /> : null}
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                {STEP_DESCRIPTION[activeStep]}
              </p>
            </div>
            {activeEntry?.required ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Required
              </span>
            ) : (
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Optional
              </span>
            )}
          </header>

          {activeEntry?.status === 'FAILED' && activeEntry.lastError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              <p>{activeEntry.lastError}</p>
              <form action={retryStepAction} className="mt-3">
                <input type="hidden" name="step" value={activeStep} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/30"
                >
                  Retry this step
                </button>
              </form>
            </div>
          ) : null}

          <div className="mt-6">
            {!reachable ? (
              <div className="space-y-3 text-sm text-slate-300">
                <p>This step unlocks once the required steps before it are complete.</p>
                <ul className="space-y-1">
                  {missingEarlier.map((entry) => (
                    <li key={entry.step}>
                      <Link
                        href={`/onboarding?step=${entry.step}`}
                        className="text-zion-300 hover:text-zion-200 font-medium"
                      >
                        {STEP_LABEL[entry.step]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <StepPanel
                state={state}
                token={token}
                activeStep={activeStep}
                isDashboard={isDashboard}
                canFinish={canFinish}
              />
            )}
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div>
              {isOptional &&
              activeEntry?.status !== 'COMPLETED' &&
              activeEntry?.status !== 'SKIPPED' ? (
                <form action={skipStepAction}>
                  <input type="hidden" name="step" value={activeStep} />
                  <button
                    type="submit"
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                  >
                    Skip for now
                  </button>
                </form>
              ) : null}
            </div>
            {nextStep ? (
              <Link
                href={`/onboarding?step=${nextStep}`}
                className="text-zion-300 hover:text-zion-200 text-sm font-medium"
              >
                Continue to {STEP_LABEL[nextStep]} →
              </Link>
            ) : null}
          </footer>
        </section>
      </div>
    </main>
  );
}

async function StepPanel({
  state,
  token,
  activeStep,
  isDashboard,
  canFinish,
}: {
  state: OnboardingState;
  token: string;
  activeStep: OnboardingStep;
  isDashboard: boolean;
  canFinish: boolean;
}) {
  if (isDashboard) {
    return (
      <div className="space-y-4 text-sm text-slate-300">
        <p>
          {canFinish
            ? 'Every required step is complete. Open your dashboard to start running the workspace.'
            : 'Finish the required steps above before opening the dashboard.'}
        </p>
        {canFinish ? (
          <form action={completeOnboardingAction}>
            <button
              type="submit"
              className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition"
            >
              Open the dashboard
            </button>
          </form>
        ) : (
          <ul className="space-y-1">
            {state.requiredStepsRemaining.map((step) => (
              <li key={step}>
                <Link
                  href={`/onboarding?step=${step}`}
                  className="text-zion-300 hover:text-zion-200 font-medium"
                >
                  {STEP_LABEL[step]}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (INFORMATIONAL_STEPS.includes(activeStep)) {
    const entry = state.steps.find((candidate) => candidate.step === activeStep);
    const done = entry?.status === 'COMPLETED' || entry?.status === 'SKIPPED';
    return (
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          {done
            ? 'Done automatically. Zion8 handled this step for you.'
            : 'This step is processed automatically as the workspace is prepared.'}
        </p>
        {entry && entry.attemptCount > 0 ? (
          <p className={hintClass}>Attempts: {entry.attemptCount}</p>
        ) : null}
      </div>
    );
  }

  switch (activeStep) {
    case 'WORKSPACE_CREATION': {
      const profile = await api.getWorkspace(token);
      return <WorkspaceForm profile={profile} disabled={false} />;
    }
    case 'BRAND_CUSTOMIZATION': {
      const theme = await api.getBranding(token);
      return <BrandingForm theme={theme} disabled={false} />;
    }
    case 'SUBSCRIPTION_SELECTION': {
      const [catalog, subscription] = await Promise.all([
        api.getPlanCatalog(token),
        api.getSubscription(token),
      ]);
      return (
        <SubscriptionSelector catalog={catalog} subscription={subscription} disabled={false} />
      );
    }
    case 'ADMINISTRATOR_INVITATION': {
      const { invitations } = await api.listInvitations(token);
      return <InvitationManager invitations={invitations} disabled={false} />;
    }
    case 'FIRST_MEMBER_IMPORT': {
      const { jobs } = await api.listMemberImports(token);
      return <MemberImportForm jobs={jobs} disabled={false} />;
    }
    default:
      return null;
  }
}
