import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from '@/components/sign-up-form';

export const metadata: Metadata = { title: 'Create your church workspace' };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Zion<span className="text-zion-400">8</span>
      </Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Create your church workspace</h1>
      <p className="mt-2 text-sm text-slate-400">
        You will become the owner of a new, isolated workspace on Zion8.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <SignUpForm />
      </div>
    </main>
  );
}
