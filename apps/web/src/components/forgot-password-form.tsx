'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { initialAuthState, requestPasswordResetAction } from '@/app/auth-actions';

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialAuthState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          {state.message}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-slate-200">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="focus:border-zion-400 focus:ring-zion-500/30 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-zion-600 hover:bg-zion-500 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Sending...' : 'Send reset link'}
      </button>

      <p className="text-center text-sm text-slate-400">
        <Link href="/sign-in" className="text-zion-300 hover:text-zion-200 font-medium">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
