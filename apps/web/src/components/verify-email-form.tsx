'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { initialAuthState, verifyEmailAction } from '@/app/auth-actions';

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(verifyEmailAction, initialAuthState);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.status === 'error' && state.message ? (
        <div className="space-y-4">
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {state.message}
          </p>
          <Link
            href="/sign-in"
            className="text-zion-300 hover:text-zion-200 block text-center text-sm font-medium"
          >
            Continue to sign in
          </Link>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-300" role="status">
          {isPending ? 'Verifying your email...' : 'Confirming your email address...'}
        </p>
      )}
    </form>
  );
}
