'use client';

import { useActionState } from 'react';
import { RelationshipType } from '@zion8/contracts';
import { createRelationshipFromGraphAction } from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import type { MemberOption } from './member-options';
import { MemberOptions } from './member-options';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const TYPES = Object.values(RelationshipType);

/**
 * Records a relationship from the graph's root member. The inverse edge is
 * derived by the domain, so only one direction is ever described.
 */
export function RelationshipGraphForm({
  fromMemberId,
  members,
}: {
  fromMemberId: string;
  members: MemberOption[];
}) {
  const [state, formAction] = useActionState(createRelationshipFromGraphAction, initialFormState);
  const available = members.filter((member) => member.id !== fromMemberId);

  if (available.length === 0) {
    return <p className="text-sm text-slate-400">Add another member before recording relationships.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="fromMemberId" value={fromMemberId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="This member is" htmlFor="graph-type">
          <select id="graph-type" name="type" defaultValue={RelationshipType.FRIEND} className={inputClass}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Related to" htmlFor="graph-to">
          <select id="graph-to" name="toMemberId" required className={inputClass}>
            <option value="">Select a member</option>
            <MemberOptions members={available} />
          </select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="graph-notes">
        <input id="graph-notes" name="notes" maxLength={1000} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Recording...">Record relationship</SubmitButton>
    </form>
  );
}
