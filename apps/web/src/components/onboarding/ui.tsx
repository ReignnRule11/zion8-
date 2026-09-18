import type { OnboardingStepStatus } from '@zion8/contracts';
import type { OnboardingFormState } from '@/app/onboarding/state';

export const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-zion-400 focus:ring-2 focus:ring-zion-500/30';

export const labelClass = 'block text-sm font-medium text-slate-200';

export const hintClass = 'text-xs text-slate-500';

export function FormFeedback({ state }: { state: OnboardingFormState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
      >
        <p>{state.message}</p>
        {state.issues && state.issues.length > 0 ? (
          <ul className="list-inside list-disc space-y-1 text-xs text-red-200/90">
            {state.issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                {issue.path ? <span className="font-medium">{issue.path}: </span> : null}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <p
      role="status"
      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {state.message}
    </p>
  );
}

const STATUS_STYLES: Record<OnboardingStepStatus, string> = {
  PENDING: 'border-white/10 bg-white/5 text-slate-400',
  IN_PROGRESS: 'border-zion-400/40 bg-zion-500/10 text-zion-200',
  COMPLETED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  SKIPPED: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  FAILED: 'border-red-500/40 bg-red-500/10 text-red-200',
};

export function StepStatusBadge({ status }: { status: OnboardingStepStatus }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
