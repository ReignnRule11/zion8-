'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { initialAuthState, verifyMfaAction } from '@/app/auth-actions';

export function MfaForm() {
  const [state, formAction, isPending] = useActionState(verifyMfaAction, initialAuthState);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === 'error' && state.message ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {state.message}
        </p>
      ) : null}

      {useRecoveryCode ? (
        <div className="space-y-1.5">
          <label htmlFor="recoveryCode" className="block text-sm font-medium text-slate-200">
            Recovery code
          </label>
          <input
            id="recoveryCode"
            name="recoveryCode"
            type="text"
            autoComplete="one-time-code"
            required
            className="focus:border-zion-400 focus:ring-zion-500/30 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:ring-2"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-sm font-medium text-slate-200">
            Authentication code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            className="focus:border-zion-400 focus:ring-zion-500/30 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] outline-none transition focus:ring-2"
          />
          <p className="text-xs text-slate-500">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-zion-600 hover:bg-zion-500 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Verifying...' : 'Verify'}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setUseRecoveryCode((value) => !value)}
          className="text-zion-300 hover:text-zion-200 font-medium"
        >
          {useRecoveryCode ? 'Use authenticator code' : 'Use a recovery code'}
        </button>
        <Link href="/sign-in" className="text-slate-400 hover:text-slate-200">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
