'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { InvitationPreview } from '@zion8/contracts';
import { acceptInvitationAction, declineInvitationAction } from '@/app/onboarding/actions';
import { initialOnboardingState } from '@/app/onboarding/state';
import { FormFeedback, hintClass, inputClass, labelClass } from './onboarding/ui';
import { SubmitButton } from './onboarding/submit-button';

export function AcceptInvitationForm({
  preview,
  token,
}: {
  preview: InvitationPreview;
  token: string;
}) {
  const [acceptState, acceptAction] = useActionState(
    acceptInvitationAction,
    initialOnboardingState,
  );
  const [declineState, declineAction] = useActionState(
    declineInvitationAction,
    initialOnboardingState,
  );

  if (preview.status !== 'PENDING') {
    return (
      <div className="space-y-4 text-sm text-slate-300">
        <p role="status">
          This invitation is {preview.status.toLowerCase()} and can no longer be accepted.
        </p>
        <Link href="/sign-in" className="text-zion-300 hover:text-zion-200 font-medium">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FormFeedback state={acceptState} />

      <form action={acceptAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        {preview.accountExists ? (
          <p className="text-sm text-slate-300">
            You already have a Zion8 account for {preview.email}. Accepting links it to{' '}
            {preview.tenantName}.
          </p>
        ) : (
          <fieldset className="space-y-4">
            <legend className={labelClass}>Create your account</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className={labelClass}>
                  First name
                </label>
                <input id="firstName" name="firstName" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className={labelClass}>
                  Last name
                </label>
                <input id="lastName" name="lastName" className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                className={inputClass}
              />
              <p className={hintClass}>At least 12 characters, including a letter and a number.</p>
            </div>
          </fieldset>
        )}

        <SubmitButton pendingLabel="Joining...">Join {preview.tenantName}</SubmitButton>
      </form>

      <form action={declineAction} className="border-t border-white/10 pt-4">
        <input type="hidden" name="token" value={token} />
        {declineState.status === 'success' ? (
          <p className="text-sm text-slate-300">{declineState.message}</p>
        ) : (
          <button type="submit" className="text-sm text-slate-400 transition hover:text-slate-200">
            Decline this invitation
          </button>
        )}
      </form>
    </div>
  );
}
