'use client';

import { useActionState } from 'react';
import {
  addVisitorVisitAction,
  convertVisitorAction,
} from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, hintClass, inputClass } from './ui';
import { SubmitButton } from './submit-button';

export function VisitorVisitForm({ visitorId }: { visitorId: string }) {
  const [state, formAction] = useActionState(addVisitorVisitAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="visitorId" value={visitorId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="When" htmlFor="visit-occurredAt">
          <input
            id="visit-occurredAt"
            name="occurredAt"
            type="datetime-local"
            className={inputClass}
          />
        </Field>
        <Field label="Service" htmlFor="visit-serviceName">
          <input id="visit-serviceName" name="serviceName" className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-200">
        <input name="attended" type="checkbox" defaultChecked className="h-4 w-4 rounded" />
        They attended this service
      </label>
      <Field label="Notes" htmlFor="visit-notes">
        <input id="visit-notes" name="notes" maxLength={1000} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Recording..." variant="secondary">
        Log visit
      </SubmitButton>
    </form>
  );
}

export function VisitorConvertForm({
  visitorId,
  defaults,
}: {
  visitorId: string;
  defaults: { firstName: string; lastName: string; email: string | null; phone: string | null };
}) {
  const [state, formAction] = useActionState(convertVisitorAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="visitorId" value={visitorId} />
      <p className={hintClass}>
        Confirming creates a member record, links it to this visitor, and keeps the visit history.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="convert-firstName">
          <input
            id="convert-firstName"
            name="firstName"
            defaultValue={defaults.firstName}
            className={inputClass}
          />
        </Field>
        <Field label="Last name" htmlFor="convert-lastName">
          <input
            id="convert-lastName"
            name="lastName"
            defaultValue={defaults.lastName}
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor="convert-email">
          <input
            id="convert-email"
            name="email"
            type="email"
            defaultValue={defaults.email ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Phone" htmlFor="convert-phone">
          <input
            id="convert-phone"
            name="phone"
            defaultValue={defaults.phone ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Joined on" htmlFor="convert-joinedAt">
          <input id="convert-joinedAt" name="joinedAt" type="datetime-local" className={inputClass} />
        </Field>
        <Field label="City" htmlFor="convert-city">
          <input id="convert-city" name="city" className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Converting...">Convert to member</SubmitButton>
    </form>
  );
}
