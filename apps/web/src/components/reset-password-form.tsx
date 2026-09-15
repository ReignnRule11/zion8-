'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { initialAuthState, resetPasswordAction } from '@/app/auth-actions';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialAuthState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.status === 'error' && state.message ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {state.message}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="newPassword" className="block text-sm font-medium text-slate-200">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="focus:border-zion-400 focus:ring-zion-500/30 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="focus:border-zion-400 focus:ring-zion-500/30 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-zion-600 hover:bg-zion-500 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Updating...' : 'Update password'}
      </button>

      <p className="text-center text-sm text-slate-400">
        <Link href="/sign-in" className="text-zion-300 hover:text-zion-200 font-medium">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
