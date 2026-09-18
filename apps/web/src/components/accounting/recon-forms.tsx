'use client';

import { useActionState } from 'react';
import { BankTransactionKind, type Account } from '@zion8/contracts';
import {
  addBankTransactionAction,
  createBankAccountAction,
  createReconciliationAction,
  matchReconciliationAction,
} from '@/app/(dashboard)/accounting/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

export function BankAccountForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(createBankAccountAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="bank-name">
          <input id="bank-name" name="name" required placeholder="Operating checking" className={inputClass} />
        </Field>
        <Field label="Institution" htmlFor="bank-institution">
          <input id="bank-institution" name="institution" className={inputClass} />
        </Field>
        <Field label="Masked number" htmlFor="bank-mask">
          <input id="bank-mask" name="accountNumberMasked" placeholder="****1042" className={inputClass} />
        </Field>
        <Field label="GL account" htmlFor="bank-gl">
          <select id="bank-gl" name="glAccountId" required className={inputClass}>
            <option value="">Select cash account</option>
            {accounts
              .filter((account) => account.type === 'ASSET')
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <SubmitButton pendingLabel="Creating bank">Create bank account</SubmitButton>
    </form>
  );
}

export function BankTransactionForm({ bankAccountId }: { bankAccountId: string }) {
  const [state, formAction] = useActionState(addBankTransactionAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="bankAccountId" value={bankAccountId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Occurred on" htmlFor="txn-date">
          <input id="txn-date" name="occurredOn" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Amount" htmlFor="txn-amount">
          <input id="txn-amount" name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
        </Field>
        <Field label="Kind" htmlFor="txn-kind">
          <select id="txn-kind" name="kind" defaultValue={BankTransactionKind.DEPOSIT} className={inputClass}>
            <option value={BankTransactionKind.DEPOSIT}>Deposit</option>
            <option value={BankTransactionKind.WITHDRAWAL}>Withdrawal</option>
          </select>
        </Field>
        <Field label="External ref" htmlFor="txn-ref">
          <input id="txn-ref" name="externalRef" className={inputClass} />
        </Field>
      </div>
      <Field label="Description" htmlFor="txn-desc">
        <input id="txn-desc" name="description" required className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Adding transaction">Add transaction</SubmitButton>
    </form>
  );
}

export function ReconciliationForm({ bankAccountId }: { bankAccountId: string }) {
  const [state, formAction] = useActionState(createReconciliationAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="bankAccountId" value={bankAccountId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Statement date" htmlFor="rec-date">
          <input id="rec-date" name="statementOn" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Statement balance" htmlFor="rec-balance">
          <input id="rec-balance" name="statementBalance" type="number" step="0.01" required className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Opening recon">Open reconciliation</SubmitButton>
    </form>
  );
}

export function MatchReconciliationForm({ reconciliationId }: { reconciliationId: string }) {
  const [state, formAction] = useActionState(matchReconciliationAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="reconciliationId" value={reconciliationId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bank transaction id" htmlFor="match-txn">
          <input id="match-txn" name="bankTransactionId" required className={inputClass} />
        </Field>
        <Field label="Journal id" htmlFor="match-journal">
          <input id="match-journal" name="journalId" required className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Matching">Match</SubmitButton>
    </form>
  );
}
