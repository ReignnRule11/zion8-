'use client';

import { useActionState } from 'react';
import { type Account } from '@zion8/contracts';
import { createBudgetAction, createProjectAction } from '@/app/(dashboard)/accounting/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

export function BudgetForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(createBudgetAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="budget-name">
          <input id="budget-name" name="name" required placeholder="FY 2026 operating" className={inputClass} />
        </Field>
        <Field label="Starts on" htmlFor="budget-start">
          <input id="budget-start" name="startsOn" type="date" required className={inputClass} />
        </Field>
        <Field label="Ends on" htmlFor="budget-end">
          <input id="budget-end" name="endsOn" type="date" required className={inputClass} />
        </Field>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-200">Lines</p>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-3">
            <select name={`lineAccountId_${index}`} defaultValue="" className={inputClass}>
              <option value="">Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
            </select>
            <input name={`lineAmount_${index}`} type="number" min="0" step="0.01" placeholder="Amount" className={inputClass} />
            <input name={`lineNotes_${index}`} placeholder="Notes" className={inputClass} />
          </div>
        ))}
      </div>
      <SubmitButton pendingLabel="Creating budget">Create budget</SubmitButton>
    </form>
  );
}

export function ProjectForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(createProjectAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="project-name">
          <input id="project-name" name="name" required placeholder="Roof repair" className={inputClass} />
        </Field>
        <Field label="Budget" htmlFor="project-budget">
          <input id="project-budget" name="budget" type="number" min="0" step="0.01" className={inputClass} />
        </Field>
        <Field label="Starts on" htmlFor="project-start">
          <input id="project-start" name="startsOn" type="date" className={inputClass} />
        </Field>
        <Field label="Ends on" htmlFor="project-end">
          <input id="project-end" name="endsOn" type="date" className={inputClass} />
        </Field>
        <Field label="Expense account" htmlFor="project-expense">
          <select id="project-expense" name="expenseAccountId" defaultValue="" className={inputClass}>
            <option value="">Default (5000)</option>
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
      <Field label="Description" htmlFor="project-description">
        <textarea id="project-description" name="description" rows={2} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Creating project">Create project</SubmitButton>
    </form>
  );
}
