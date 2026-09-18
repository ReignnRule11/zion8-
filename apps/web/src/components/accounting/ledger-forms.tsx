'use client';

import { useActionState } from 'react';
import { AccountType, type Account } from '@zion8/contracts';
import {
  createAccountAction,
  createJournalAction,
  createPeriodAction,
  voidJournalAction,
} from '@/app/(dashboard)/accounting/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

const TYPES = Object.values(AccountType);

export function AccountForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(createAccountAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="account-code">
          <input id="account-code" name="code" required minLength={3} placeholder="5300" className={inputClass} />
        </Field>
        <Field label="Name" htmlFor="account-name">
          <input id="account-name" name="name" required placeholder="Missions expense" className={inputClass} />
        </Field>
        <Field label="Type" htmlFor="account-type">
          <select id="account-type" name="type" defaultValue={AccountType.EXPENSE} className={inputClass}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Parent" htmlFor="account-parent" hint="Optional grouping account.">
          <select id="account-parent" name="parentId" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} {account.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description" htmlFor="account-description">
        <textarea id="account-description" name="description" rows={2} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="isPostable" defaultChecked className="rounded border-white/20" />
        Postable
      </label>
      <SubmitButton pendingLabel="Creating account">Create account</SubmitButton>
    </form>
  );
}

export function PeriodForm() {
  const [state, formAction] = useActionState(createPeriodAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="period-name">
          <input id="period-name" name="name" required placeholder="FY 2026 Q1" className={inputClass} />
        </Field>
        <Field label="Starts on" htmlFor="period-start">
          <input id="period-start" name="startsOn" type="date" required className={inputClass} />
        </Field>
        <Field label="Ends on" htmlFor="period-end">
          <input id="period-end" name="endsOn" type="date" required className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Creating period">Create period</SubmitButton>
    </form>
  );
}

export function JournalForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(createJournalAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Memo" htmlFor="journal-memo">
          <input id="journal-memo" name="memo" required placeholder="Sunday offering transfer" className={inputClass} />
        </Field>
        <Field label="Occurred on" htmlFor="journal-date">
          <input id="journal-date" name="occurredOn" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Reference" htmlFor="journal-ref">
          <input id="journal-ref" name="reference" placeholder="JE-104" className={inputClass} />
        </Field>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-200">Lines</p>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-4">
            <select name={`lineAccountId_${index}`} defaultValue="" className={inputClass}>
              <option value="">Account</option>
              {accounts
                .filter((account) => account.isPostable)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} {account.name}
                  </option>
                ))}
            </select>
            <input name={`lineDescription_${index}`} placeholder="Description" className={inputClass} />
            <input name={`lineDebit_${index}`} type="number" min="0" step="0.01" placeholder="Debit" className={inputClass} />
            <input name={`lineCredit_${index}`} type="number" min="0" step="0.01" placeholder="Credit" className={inputClass} />
          </div>
        ))}
      </div>
      <SubmitButton pendingLabel="Saving journal">Save draft journal</SubmitButton>
    </form>
  );
}

export function VoidJournalForm({ journalId }: { journalId: string }) {
  const [state, formAction] = useActionState(voidJournalAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="journalId" value={journalId} />
      <Field label="Void reason" htmlFor="void-reason">
        <input id="void-reason" name="reason" required minLength={1} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Voiding" variant="danger">
        Void journal
      </SubmitButton>
    </form>
  );
}
