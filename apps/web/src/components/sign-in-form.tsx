'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { initialAuthState, signInAction } from '@/app/auth-actions';

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialAuthState);

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

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-slate-200">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="focus:border-zion-400 focus:ring-zion-500/30 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tenantSlug" className="block text-sm font-medium text-slate-200">
          Church workspace <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="tenantSlug"
          name="tenantSlug"
          type="text"
          placeholder="grace-chapel"
          className="focus:border-zion-400 focus:ring-zion-500/30 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-zion-600 hover:bg-zion-500 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-slate-400">
        New to Zion8?{' '}
        <Link href="/sign-up" className="text-zion-300 hover:text-zion-200 font-medium">
          Create a church workspace
        </Link>
      </p>
    </form>
  );
}
