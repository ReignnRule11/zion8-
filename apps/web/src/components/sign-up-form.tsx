'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { initialAuthState, signUpAction } from '@/app/auth-actions';

const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-zion-400 focus:ring-2 focus:ring-zion-500/30';

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialAuthState);

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

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-semibold text-slate-200">Church workspace</legend>

        <div className="space-y-1.5">
          <label htmlFor="churchName" className="block text-sm font-medium text-slate-200">
            Church name
          </label>
          <input id="churchName" name="churchName" required className={inputClass} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="slug" className="block text-sm font-medium text-slate-200">
              Workspace address
            </label>
            <input
              id="slug"
              name="slug"
              required
              placeholder="grace-chapel"
              className={inputClass}
            />
            <p className="text-xs text-slate-500">Lowercase letters, numbers, and hyphens.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="timezone" className="block text-sm font-medium text-slate-200">
              Timezone
            </label>
            <input
              id="timezone"
              name="timezone"
              placeholder="Africa/Lagos"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={isPending}>
        <legend className="text-sm font-semibold text-slate-200">Church owner</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-200">
              First name
            </label>
            <input id="firstName" name="firstName" required className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-200">
              Last name
            </label>
            <input id="lastName" name="lastName" required className={inputClass} />
          </div>
        </div>

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
            className={inputClass}
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
            autoComplete="new-password"
            required
            className={inputClass}
          />
          <p className="text-xs text-slate-500">
            At least 12 characters, including a letter and a number.
          </p>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="bg-zion-600 hover:bg-zion-500 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Creating workspace...' : 'Create church workspace'}
      </button>

      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-zion-300 hover:text-zion-200 font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}
