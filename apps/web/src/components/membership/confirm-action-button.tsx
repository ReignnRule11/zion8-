'use client';

import type { ReactNode } from 'react';
import { SubmitButton } from './submit-button';

/**
 * A submit button that asks for confirmation before running a destructive server
 * action. Cancelling prevents the submit, so the action never reaches the API.
 */
export function ConfirmActionButton({
  action,
  fields,
  children,
  pendingLabel,
  confirmMessage,
  variant = 'danger',
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  children: ReactNode;
  pendingLabel: string;
  confirmMessage?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton pendingLabel={pendingLabel} variant={variant}>
        {children}
      </SubmitButton>
    </form>
  );
}
