'use client';

import { useActionState } from 'react';
import { ContributionMethod, type Account, type Fund } from '@zion8/contracts';
import {
  createFundAction,
  recordContributionAction,
  refundContributionAction,
} from '@/app/(dashboard)/accounting/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

const METHODS = Object.values(ContributionMethod);

export function FundForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(createFundAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fund name" htmlFor="fund-name">
          <input id="fund-name" name="name" required placeholder="General tithe" className={inputClass} />
        </Field>
        <Field label="Revenue account" htmlFor="fund-revenue">
          <select id="fund-revenue" name="revenueAccountId" defaultValue="" className={inputClass}>
            <option value="">Default (4000)</option>
            {accounts
              .filter((account) => account.type === 'REVENUE')
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <Field label="Description" htmlFor="fund-description">
        <textarea id="fund-description" name="description" rows={2} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="restricted" className="rounded border-white/20" />
        Restricted
      </label>
      <SubmitButton pendingLabel="Creating fund">Create fund</SubmitButton>
    </form>
  );
}

export function ContributionForm({ funds }: { funds: Fund[] }) {
  const [state, formAction] = useActionState(recordContributionAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fund" htmlFor="gift-fund">
          <select id="gift-fund" name="fundId" required className={inputClass}>
            <option value="">Select fund</option>
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount" htmlFor="gift-amount" hint="Major units, e.g. 50.00">
          <input id="gift-amount" name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
        </Field>
        <Field label="Donor name" htmlFor="gift-donor">
          <input id="gift-donor" name="donorName" placeholder="Anonymous" className={inputClass} />
        </Field>
        <Field label="Method" htmlFor="gift-method">
          <select id="gift-method" name="method" defaultValue="CASH" className={inputClass}>
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {method.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Received on" htmlFor="gift-date">
          <input id="gift-date" name="receivedOn" type="date" required defaultValue={today} className={inputClass} />
        </Field>
        <Field label="External ref" htmlFor="gift-ref">
          <input id="gift-ref" name="externalRef" placeholder="Check 1042" className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="taxDeductible" defaultChecked className="rounded border-white/20" />
        Tax deductible
      </label>
      <SubmitButton pendingLabel="Recording gift">Record contribution</SubmitButton>
    </form>
  );
}

export function RefundContributionForm({ contributionId }: { contributionId: string }) {
  const [state, formAction] = useActionState(refundContributionAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="contributionId" value={contributionId} />
      <Field label="Refund reason" htmlFor="refund-reason">
        <input id="refund-reason" name="reason" required className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Refunding" variant="danger">
        Refund
      </SubmitButton>
    </form>
  );
}
