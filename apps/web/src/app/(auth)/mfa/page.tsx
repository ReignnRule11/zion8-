import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MfaForm } from '@/components/mfa-form';
import { getMfaChallengeToken } from '@/lib/session';

export const metadata: Metadata = { title: 'Verify your identity' };

export default async function MfaPage() {
  const token = await getMfaChallengeToken();
  if (!token) redirect('/sign-in');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Zion<span className="text-zion-400">8</span>
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Two-factor verification</h1>
      <p className="mt-2 text-sm text-slate-400">
        Your account is protected with multi-factor authentication.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <MfaForm />
      </div>
    </main>
  );
}
