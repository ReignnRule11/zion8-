import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Zion<span className="text-zion-400">8</span>
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-2 text-sm text-slate-400">
        Enter your email and we will send you a link to choose a new password.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
