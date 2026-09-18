import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { OnboardingSummary, SessionListResponse } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import { SessionList } from '@/components/session-list';
import { SignOutButton } from '@/components/sign-out-button';

export const metadata: Metadata = { title: 'Workspace' };

export default async function WorkspacePage() {
  const token = await getAccessToken();
  if (!token) redirect('/sign-in');

  let profile;
  let sessionList: SessionListResponse;
  try {
    [profile, sessionList] = await Promise.all([api.me(token), api.listSessions(token)]);
  } catch (error) {
    if (error instanceof ApiRequestError && error.isUnauthenticated) {
      redirect('/sign-in');
    }
    throw error;
  }

  const permissions = profile.permissions;

  let onboarding: OnboardingSummary | null = null;
  if (profile.activeTenant) {
    try {
      onboarding = await api.getOnboardingSummary(token);
    } catch (error) {
      if (error instanceof ApiRequestError && error.isUnauthenticated) {
        redirect('/sign-in');
      }
      onboarding = null;
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <span className="text-lg font-semibold tracking-tight">
            Zion<span className="text-zion-400">8</span>
          </span>
          <p className="text-sm text-slate-400">
            {profile.principal.firstName} {profile.principal.lastName}
            {profile.principal.isPlatformAdmin ? ' · Platform Administrator' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {profile.activeTenant ? (
            <Link
              href="/home"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30"
            >
              Home
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </header>

      {onboarding && !onboarding.completed ? (
        <section className="border-zion-500/40 bg-zion-500/10 mt-8 rounded-2xl border p-6">
          <h2 className="text-zion-200 text-sm font-medium uppercase tracking-wide">
            Finish setting up your workspace
          </h2>
          <p className="mt-2 text-sm text-slate-200">
            Your church setup is {onboarding.percentComplete}% complete. Continue from{' '}
            {onboarding.currentStep.replaceAll('_', ' ').toLowerCase()}.
          </p>
          <Link
            href="/onboarding"
            className="bg-zion-600 hover:bg-zion-500 mt-4 inline-block rounded-lg px-4 py-2.5 text-sm font-medium text-white transition"
          >
            Continue onboarding
          </Link>
        </section>
      ) : null}

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Active workspace
          </h2>
          {profile.activeTenant ? (
            <>
              <p className="mt-3 text-xl font-semibold">{profile.activeTenant.name}</p>
              <p className="text-sm text-slate-400">/{profile.activeTenant.slug}</p>
            </>
          ) : (
            <p className="mt-3 text-slate-300">
              No workspace selected. Select a workspace from the list below.
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Your role</h2>
          <p className="mt-3 text-xl font-semibold">
            {profile.role ? profile.role.replaceAll('_', ' ') : 'Platform level'}
          </p>
          <p className="text-sm text-slate-400">{permissions.length} permissions granted</p>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Memberships</h2>
        {profile.memberships.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            You do not belong to any church workspace yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
            {profile.memberships.map((membership) => (
              <li key={membership.tenantId} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium">{membership.tenantName}</p>
                  <p className="text-sm text-slate-400">/{membership.tenantSlug}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{membership.role.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-slate-400">{membership.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Active sessions</h2>
        <p className="mt-1 text-sm text-slate-400">
          Revoke any device you no longer recognise. Revoking signs it out immediately.
        </p>
        <SessionList sessions={sessionList.sessions} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Granted permissions</h2>
        {permissions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No permissions are granted in the current workspace context.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {permissions.map((permission) => (
              <li
                key={permission}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
              >
                {permission}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
