'use client';

import { useActionState } from 'react';
import { addTimelineNoteAction } from '@/app/(dashboard)/people/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, hintClass, inputClass } from './ui';
import { SubmitButton } from './submit-button';

/** Adds a pastoral note to a member's timeline. Notes are the only manual entries. */
export function TimelineNoteForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(addTimelineNoteAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="memberId" value={memberId} />

      <Field label="Title" htmlFor="timeline-title">
        <input
          id="timeline-title"
          name="title"
          required
          maxLength={160}
          placeholder="Home visit"
          className={inputClass}
        />
      </Field>
      <Field label="Details" htmlFor="timeline-summary">
        <textarea
          id="timeline-summary"
          name="summary"
          rows={3}
          maxLength={2000}
          className={inputClass}
        />
      </Field>
      <Field label="When" htmlFor="timeline-occurredAt" hint="Leave empty to record it now.">
        <input
          id="timeline-occurredAt"
          name="occurredAt"
          type="datetime-local"
          className={inputClass}
        />
      </Field>
      <p className={hintClass}>Notes are append-only and visible to everyone with timeline access.</p>
      <SubmitButton pendingLabel="Adding...">Add note</SubmitButton>
    </form>
  );
}
