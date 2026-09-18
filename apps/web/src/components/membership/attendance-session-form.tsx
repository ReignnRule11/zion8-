'use client';

import { useActionState } from 'react';
import { AttendanceSessionKind } from '@zion8/contracts';
import { createAttendanceSessionAction } from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, hintClass, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const KINDS = Object.values(AttendanceSessionKind);

export function AttendanceSessionForm({
  departments,
}: {
  departments: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(createAttendanceSessionAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Title" htmlFor="session-title" className="sm:col-span-2">
          <input
            id="session-title"
            name="title"
            required
            minLength={2}
            placeholder="Sunday celebration service"
            className={inputClass}
          />
        </Field>
        <Field label="Kind" htmlFor="session-kind">
          <select
            id="session-kind"
            name="kind"
            defaultValue={AttendanceSessionKind.SERVICE}
            className={inputClass}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="When" htmlFor="session-occurredAt" hint="Leave empty to use the current time.">
          <input
            id="session-occurredAt"
            name="occurredAt"
            type="datetime-local"
            className={inputClass}
          />
        </Field>
        <Field label="Location" htmlFor="session-location">
          <input id="session-location" name="location" className={inputClass} />
        </Field>
        <Field label="Expected headcount" htmlFor="session-expectedCount">
          <input
            id="session-expectedCount"
            name="expectedCount"
            type="number"
            min={0}
            className={inputClass}
          />
        </Field>
        <Field label="Led by department" htmlFor="session-departmentId" className="sm:col-span-2">
          <select
            id="session-departmentId"
            name="departmentId"
            defaultValue=""
            className={inputClass}
          >
            <option value="">No department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="session-notes">
        <textarea id="session-notes" name="notes" rows={3} className={inputClass} />
      </Field>
      <p className={hintClass}>Sessions open for marking until you close them.</p>
      <SubmitButton pendingLabel="Creating...">Create session</SubmitButton>
    </form>
  );
}
