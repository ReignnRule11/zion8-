'use client';

import { useActionState } from 'react';
import {
  DepartmentMemberRole,
  FamilyRole,
  VolunteerAssignmentStatus,
} from '@zion8/contracts';
import {
  addDepartmentMemberAction,
  addFamilyMemberAction,
  assignVolunteerAction,
} from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import type { MemberOption } from './member-options';
import { MemberOptions } from './member-options';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

function MemberPicker({
  id,
  members,
  excludeId,
}: {
  id: string;
  members: MemberOption[];
  excludeId?: string;
}) {
  if (members.length === 0) {
    return <p className="text-sm text-slate-400">No members available to add.</p>;
  }
  return (
    <select id={id} name="memberId" required defaultValue="" className={inputClass}>
      <option value="">Select a member</option>
      <MemberOptions members={members} excludeId={excludeId} />
    </select>
  );
}

export function FamilyMemberForm({
  familyId,
  members,
  excludeIds,
}: {
  familyId: string;
  members: MemberOption[];
  excludeIds: string[];
}) {
  const [state, formAction] = useActionState(addFamilyMemberAction, initialFormState);
  const available = members.filter((member) => !excludeIds.includes(member.id));

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="familyId" value={familyId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Member" htmlFor="family-memberId">
          <MemberPicker id="family-memberId" members={available} />
        </Field>
        <Field label="Role in family" htmlFor="family-role">
          <select
            id="family-role"
            name="role"
            defaultValue={FamilyRole.OTHER}
            className={inputClass}
          >
            {Object.values(FamilyRole).map((role) => (
              <option key={role} value={role}>
                {role.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SubmitButton pendingLabel="Adding..." variant="secondary">
        Add to family
      </SubmitButton>
    </form>
  );
}

export function DepartmentMemberForm({
  departmentId,
  members,
  excludeIds,
}: {
  departmentId: string;
  members: MemberOption[];
  excludeIds: string[];
}) {
  const [state, formAction] = useActionState(addDepartmentMemberAction, initialFormState);
  const available = members.filter((member) => !excludeIds.includes(member.id));

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="departmentId" value={departmentId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Member" htmlFor="department-memberId">
          <MemberPicker id="department-memberId" members={available} />
        </Field>
        <Field label="Role" htmlFor="department-role">
          <select
            id="department-role"
            name="role"
            defaultValue={DepartmentMemberRole.MEMBER}
            className={inputClass}
          >
            {Object.values(DepartmentMemberRole).map((role) => (
              <option key={role} value={role}>
                {role.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Joined on" htmlFor="department-joinedAt">
          <input
            id="department-joinedAt"
            name="joinedAt"
            type="datetime-local"
            className={inputClass}
          />
        </Field>
      </div>
      <SubmitButton pendingLabel="Adding..." variant="secondary">
        Add to department
      </SubmitButton>
    </form>
  );
}

export function VolunteerAssignmentForm({
  roleId,
  members,
}: {
  roleId: string;
  members: MemberOption[];
}) {
  const [state, formAction] = useActionState(assignVolunteerAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="roleId" value={roleId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Member" htmlFor="assignment-memberId">
          <MemberPicker id="assignment-memberId" members={members} />
        </Field>
        <Field label="Status" htmlFor="assignment-status">
          <select
            id="assignment-status"
            name="status"
            defaultValue={VolunteerAssignmentStatus.ACTIVE}
            className={inputClass}
          >
            {Object.values(VolunteerAssignmentStatus).map((status) => (
              <option key={status} value={status}>
                {status.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts on" htmlFor="assignment-startsAt">
          <input
            id="assignment-startsAt"
            name="startsAt"
            type="datetime-local"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Notes" htmlFor="assignment-notes">
        <input id="assignment-notes" name="notes" maxLength={1000} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Assigning..." variant="secondary">
        Assign volunteer
      </SubmitButton>
    </form>
  );
}
