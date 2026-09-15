import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/components/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect('/forgot-password');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Zion<span className="text-zion-400">8</span>
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-sm text-slate-400">
        Your new password must be at least 10 characters and hard to guess.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
