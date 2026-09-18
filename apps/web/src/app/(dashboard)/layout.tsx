import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionNav } from '@/components/membership/section-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { loadPrincipal } from '@/lib/principal';

export const metadata: Metadata = { title: 'Workspace' };
export const dynamic = 'force-dynamic';

/**
 * Shell for the signed-in workspace. It resolves the session once, shows which
 * church is active, and hands the page below a stable frame so each screen only
 * has to fetch and render its own slice of the domain.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { me } = await loadPrincipal();
  const workspace = me.activeTenant;

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/home" className="text-lg font-semibold tracking-tight">
            Zion<span className="text-zion-400">8</span>
          </Link>
          <p className="text-sm text-slate-400">
            {workspace ? `${workspace.name} · /${workspace.slug}` : 'No active workspace'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/workspace"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30"
          >
            Workspace
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div className="mt-6 border-b border-white/10 pb-3">
        <SectionNav />
      </div>

      {workspace ? (
        <main id="workspace-main" className="mt-8 space-y-10">
          {children}
        </main>
      ) : (
        <main id="workspace-main" className="mt-8">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-6 py-8 text-sm text-amber-100">
            Select or create a church workspace before opening the dashboard.
          </div>
        </main>
      )}
    </div>
  );
}
