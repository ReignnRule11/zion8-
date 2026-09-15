'use client';

import { signOutAction } from '@/app/auth-actions';

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30"
      >
        Sign out
      </button>
    </form>
  );
}
