'use client';

import { useActionState } from 'react';
import { VisitorSource, VisitorStatus } from '@zion8/contracts';
import { createVisitorAction } from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const STATUSES = Object.values(VisitorStatus);
const SOURCES = Object.values(VisitorSource);

export function VisitorForm() {
  const [state, formAction] = useActionState(createVisitorAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="visitor-firstName">
          <input id="visitor-firstName" name="firstName" required className={inputClass} />
        </Field>
        <Field label="Last name" htmlFor="visitor-lastName">
          <input id="visitor-lastName" name="lastName" required className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="visitor-email">
          <input id="visitor-email" name="email" type="email" className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="visitor-phone">
          <input id="visitor-phone" name="phone" className={inputClass} />
        </Field>
        <Field label="Status" htmlFor="visitor-status">
          <select
            id="visitor-status"
            name="status"
            defaultValue={VisitorStatus.NEW}
            className={inputClass}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How they came" htmlFor="visitor-source">
          <select
            id="visitor-source"
            name="source"
            defaultValue={VisitorSource.WALK_IN}
            className={inputClass}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First visit" htmlFor="visitor-firstVisitAt">
          <input
            id="visitor-firstVisitAt"
            name="firstVisitAt"
            type="datetime-local"
            className={inputClass}
          />
        </Field>
        <Field label="Follow up by" htmlFor="visitor-followUpAt">
          <input
            id="visitor-followUpAt"
            name="followUpAt"
            type="datetime-local"
            className={inputClass}
          />
        </Field>
        <Field label="City" htmlFor="visitor-city">
          <input id="visitor-city" name="city" className={inputClass} />
        </Field>
        <Field label="Interests" htmlFor="visitor-interests" hint="Comma separated.">
          <input id="visitor-interests" name="interests" className={inputClass} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="visitor-notes">
        <textarea id="visitor-notes" name="notes" rows={3} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Saving...">Add visitor</SubmitButton>
    </form>
  );
}
