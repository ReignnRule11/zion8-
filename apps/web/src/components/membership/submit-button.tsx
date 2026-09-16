'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

const VARIANTS = {
  primary: 'bg-zion-600 hover:bg-zion-500 text-white',
  secondary: 'border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200',
  danger: 'border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-200',
} as const;

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
