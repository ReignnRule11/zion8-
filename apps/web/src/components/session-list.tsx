'use client';

import { useActionState } from 'react';
import { revokeSessionAction } from '@/app/auth-actions';
import type { AuthSessionSummary } from '@zion8/contracts';

function describe(entry: AuthSessionSummary): string {
  if (entry.deviceName) return entry.deviceName;
  if (entry.userAgent) return entry.userAgent.slice(0, 60);
  return 'Unknown device';
}

export function SessionList({ sessions }: { sessions: AuthSessionSummary[] }) {
  const [, formAction, isPending] = useActionState(
    async (_previous: null, formData: FormData) => {
      await revokeSessionAction(formData);
      return null;
    },
    null,
  );

  if (sessions.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No active sessions were found.</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
      {sessions.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {describe(entry)}
              {entry.current ? (
                <span className="border-zion-400/40 bg-zion-400/10 text-zion-200 ml-2 rounded-full border px-2 py-0.5 text-xs">
                  This device
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-slate-400">
              Last active {new Date(entry.lastSeenAt).toLocaleString()} - {entry.status}
            </p>
          </div>
          {entry.current ? null : (
            <form action={formAction}>
              <input type="hidden" name="sessionId" value={entry.id} />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                Revoke
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
