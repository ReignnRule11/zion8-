'use client';

import { useActionState } from 'react';
import { DepartmentKind } from '@zion8/contracts';
import { createDepartmentAction } from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import type { MemberOption } from './member-options';
import { MemberOptions } from './member-options';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const KINDS = Object.values(DepartmentKind);
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function DepartmentForm({ members }: { members: MemberOption[] }) {
  const [state, formAction] = useActionState(createDepartmentAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department name" htmlFor="department-name">
          <input
            id="department-name"
            name="name"
            required
            minLength={2}
            placeholder="Ushering team"
            className={inputClass}
          />
        </Field>
        <Field label="Kind" htmlFor="department-kind">
          <select
            id="department-kind"
            name="kind"
            defaultValue={DepartmentKind.MINISTRY}
            className={inputClass}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Leader" htmlFor="department-leader">
          <select id="department-leader" name="leaderMemberId" defaultValue="" className={inputClass}>
            <option value="">Not assigned</option>
            <MemberOptions members={members} />
          </select>
        </Field>
        <Field label="Location" htmlFor="department-location">
          <input id="department-location" name="location" className={inputClass} />
        </Field>
        <Field label="Meets on" htmlFor="department-day">
          <select id="department-day" name="meetingDay" defaultValue="" className={inputClass}>
            <option value="">No fixed day</option>
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Meeting time" htmlFor="department-time" hint="24-hour HH:MM.">
          <input id="department-time" name="meetingTime" type="time" className={inputClass} />
        </Field>
      </div>
      <Field label="Description" htmlFor="department-description">
        <textarea id="department-description" name="description" rows={3} className={inputClass} />
      </Field>
      <label className="flex items-center gap-3 text-sm text-slate-200">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded"
        />
        Currently active
      </label>
      <SubmitButton pendingLabel="Creating...">Create department</SubmitButton>
    </form>
  );
}
