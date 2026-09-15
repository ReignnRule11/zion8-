import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/components/sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Zion<span className="text-zion-400">8</span>
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-slate-400">Sign in to your church workspace to continue.</p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <SignInForm />
      </div>
    </main>
  );
}
