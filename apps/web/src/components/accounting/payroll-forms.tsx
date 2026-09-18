'use client';

import { useActionState } from 'react';
import { PayFrequency, type Account } from '@zion8/contracts';
import { createPayrollEmployeeAction, createPayrollRunAction } from '@/app/(dashboard)/accounting/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

const FREQUENCIES = Object.values(PayFrequency);

export function PayrollEmployeeForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(createPayrollEmployeeAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="emp-name">
          <input id="emp-name" name="displayName" required placeholder="Ada Okonkwo" className={inputClass} />
        </Field>
        <Field label="Title" htmlFor="emp-title">
          <input id="emp-title" name="title" placeholder="Pastor" className={inputClass} />
        </Field>
        <Field label="Gross pay" htmlFor="emp-gross" hint="Per pay period, major units.">
          <input id="emp-gross" name="gross" type="number" min="0" step="0.01" required className={inputClass} />
        </Field>
        <Field label="Frequency" htmlFor="emp-freq">
          <select id="emp-freq" name="payFrequency" defaultValue="MONTHLY" className={inputClass}>
            {FREQUENCIES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expense account" htmlFor="emp-expense">
          <select id="emp-expense" name="expenseAccountId" defaultValue="" className={inputClass}>
            <option value="">Default (5100)</option>
            {accounts
              .filter((account) => account.type === 'EXPENSE')
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <SubmitButton pendingLabel="Adding employee">Add employee</SubmitButton>
    </form>
  );
}

export function PayrollRunForm() {
  const [state, formAction] = useActionState(createPayrollRunAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Period start" htmlFor="run-start">
          <input id="run-start" name="periodStart" type="date" required className={inputClass} />
        </Field>
        <Field label="Period end" htmlFor="run-end">
          <input id="run-end" name="periodEnd" type="date" required className={inputClass} />
        </Field>
        <Field label="Pay on" htmlFor="run-pay">
          <input id="run-pay" name="payOn" type="date" required className={inputClass} />
        </Field>
      </div>
      <Field label="Memo" htmlFor="run-memo">
        <input id="run-memo" name="memo" placeholder="March payroll" className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Creating run">Create payroll run</SubmitButton>
    </form>
  );
}
