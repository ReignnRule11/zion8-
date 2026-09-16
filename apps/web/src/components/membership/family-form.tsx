'use client';

import { useActionState } from 'react';
import { FamilyStatus, type FamilyResponse } from '@zion8/contracts';
import { createFamilyAction } from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const STATUSES = Object.values(FamilyStatus);

export function FamilyForm({ family }: { family?: FamilyResponse }) {
  const [state, formAction] = useActionState(createFamilyAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Family name" htmlFor="family-name">
          <input
            id="family-name"
            name="name"
            required
            minLength={2}
            defaultValue={family?.name ?? ''}
            placeholder="The Adeyemi family"
            className={inputClass}
          />
        </Field>
        <Field label="Status" htmlFor="family-status">
          <select
            id="family-status"
            name="status"
            defaultValue={family?.status ?? FamilyStatus.ACTIVE}
            className={inputClass}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Home address" htmlFor="family-address">
          <input
            id="family-address"
            name="addressLine1"
            defaultValue={family?.addressLine1 ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="City" htmlFor="family-city">
          <input id="family-city" name="city" defaultValue={family?.city ?? ''} className={inputClass} />
        </Field>
        <Field label="Country code" htmlFor="family-country" hint="Two-letter ISO code.">
          <input
            id="family-country"
            name="countryCode"
            maxLength={2}
            defaultValue={family?.countryCode ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Home phone" htmlFor="family-phone">
          <input
            id="family-phone"
            name="homePhone"
            defaultValue={family?.homePhone ?? ''}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Notes" htmlFor="family-notes">
        <textarea
          id="family-notes"
          name="notes"
          rows={3}
          defaultValue={family?.notes ?? ''}
          className={inputClass}
        />
      </Field>
      <SubmitButton pendingLabel="Saving...">Create family</SubmitButton>
    </form>
  );
}
