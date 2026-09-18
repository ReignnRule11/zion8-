import Link from 'next/link';
import type { OnboardingState, OnboardingStep } from '@zion8/contracts';
import { STEP_LABEL } from './steps';
import { StepStatusBadge } from './ui';

const DOT_STYLES: Record<string, string> = {
  COMPLETED: 'border-emerald-400 bg-emerald-500 text-slate-950',
  SKIPPED: 'border-amber-400 bg-amber-500 text-slate-950',
  IN_PROGRESS: 'border-zion-300 bg-zion-500 text-white',
  FAILED: 'border-red-400 bg-red-500 text-white',
  PENDING: 'border-white/20 bg-white/5 text-slate-400',
};

export function OnboardingStepper({
  state,
  activeStep,
}: {
  state: OnboardingState;
  activeStep: OnboardingStep;
}) {
  return (
    <ol className="space-y-1">
      {state.steps.map((entry, index) => {
        const isActive = entry.step === activeStep;
        return (
          <li key={entry.step}>
            <Link
              href={`/onboarding?step=${entry.step}`}
              className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  DOT_STYLES[entry.status] ?? DOT_STYLES.PENDING
                }`}
              >
                {entry.status === 'COMPLETED' ? '✓' : entry.status === 'SKIPPED' ? '–' : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={`truncate text-sm font-medium ${
                      isActive ? 'text-white' : 'text-slate-200'
                    }`}
                  >
                    {STEP_LABEL[entry.step]}
                  </span>
                  {entry.required ? (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      required
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <StepStatusBadge status={entry.status} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
