import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MagicLinkForm } from '@/components/magic-link-form';
import { getMfaChallengeToken, getRefreshToken } from '@/lib/session';

export const metadata: Metadata = { title: 'Signing you in' };

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect('/sign-in');

  const existingSession = (await getRefreshToken()) ?? (await getMfaChallengeToken());
  if (existingSession) redirect('/workspace');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Zion<span className="text-zion-400">8</span>
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Signing you in</h1>
      <p className="mt-2 text-sm text-slate-400">
        One moment while we verify your sign-in link.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <MagicLinkForm token={token} />
      </div>
    </main>
  );
}
