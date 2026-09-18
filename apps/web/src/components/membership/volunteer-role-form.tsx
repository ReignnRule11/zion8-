'use client';

import { useActionState } from 'react';
import { VolunteerCommitment } from '@zion8/contracts';
import { createVolunteerRoleAction } from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const COMMITMENTS = Object.values(VolunteerCommitment);

export function VolunteerRoleForm({
  departments,
}: {
  departments: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(createVolunteerRoleAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role name" htmlFor="role-name">
          <input
            id="role-name"
            name="name"
            required
            minLength={2}
            placeholder="Sound desk operator"
            className={inputClass}
          />
        </Field>
        <Field label="Department" htmlFor="role-department">
          <select id="role-department" name="departmentId" defaultValue="" className={inputClass}>
            <option value="">No department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Commitment" htmlFor="role-commitment">
          <select
            id="role-commitment"
            name="commitment"
            defaultValue={VolunteerCommitment.WEEKLY}
            className={inputClass}
          >
            {COMMITMENTS.map((commitment) => (
              <option key={commitment} value={commitment}>
                {commitment.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="People needed" htmlFor="role-requiredCount">
          <input
            id="role-requiredCount"
            name="requiredCount"
            type="number"
            min={1}
            max={500}
            defaultValue={1}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Description" htmlFor="role-description">
        <textarea id="role-description" name="description" rows={3} className={inputClass} />
      </Field>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input name="requiresBackgroundCheck" type="checkbox" className="h-4 w-4 rounded" />
          Requires a background check
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded" />
          Currently recruiting
        </label>
      </div>
      <SubmitButton pendingLabel="Creating...">Create role</SubmitButton>
    </form>
  );
}
