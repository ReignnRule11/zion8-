'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const { pending } = useFormStatus();

  const styles: Record<'primary' | 'secondary' | 'danger', string> = {
    primary: 'bg-zion-600 hover:bg-zion-500 text-white',
    secondary: 'border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200',
    danger: 'border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-200',
  };

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
