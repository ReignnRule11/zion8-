'use client';

import { useActionState } from 'react';
import { RelationshipType } from '@zion8/contracts';
import { createRelationshipAction } from '@/app/(dashboard)/people/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const TYPES = Object.values(RelationshipType);

/**
 * Records a relationship from the member being viewed. The inverse edge is
 * derived by the domain, so the administrator only describes one direction.
 */
export function RelationshipForm({
  memberId,
  members,
}: {
  memberId: string;
  members: Array<{ id: string; fullName: string }>;
}) {
  const [state, formAction] = useActionState(createRelationshipAction, initialFormState);

  if (members.length === 0) {
    return <p className="text-sm text-slate-400">Add another member before recording relationships.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="memberId" value={memberId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="This member is" htmlFor="relationship-type">
          <select id="relationship-type" name="type" defaultValue={RelationshipType.FRIEND} className={inputClass}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Related to" htmlFor="relationship-to">
          <select id="relationship-to" name="toMemberId" required className={inputClass}>
            <option value="">Select a member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="relationship-notes">
        <input id="relationship-notes" name="notes" maxLength={1000} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Recording...">Record relationship</SubmitButton>
    </form>
  );
}
