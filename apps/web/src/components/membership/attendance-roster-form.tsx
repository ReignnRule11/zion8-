'use client';

import { useActionState, useState } from 'react';
import { AttendanceStatus } from '@zion8/contracts';
import { bulkMarkAttendanceAction } from '@/app/(dashboard)/community/actions';
import { initialFormState } from '@/lib/form-state';
import type { MemberOption } from './member-options';
import { FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const STATUSES = Object.values(AttendanceStatus);

/**
 * The attendance sheet. Every member is listed once, and a full roster is posted
 * as a single bulk request, which is how a service is actually recorded.
 */
export function AttendanceRosterForm({
  sessionId,
  members,
  existing,
  disabled,
}: {
  sessionId: string;
  members: MemberOption[];
  existing: Array<{ memberId: string | null; status: string }>;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(bulkMarkAttendanceAction, initialFormState);
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const record of existing) {
      if (record.memberId) initial[record.memberId] = record.status;
    }
    return initial;
  });

  const records = members
    .filter((member) => marks[member.id])
    .map((member) => ({ memberId: member.id, status: marks[member.id], method: 'MANUAL' }));

  function setAll(status: string) {
    setMarks(Object.fromEntries(members.map((member) => [member.id, status])));
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="records" value={JSON.stringify(records)} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAll(AttendanceStatus.PRESENT)}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          Mark all present
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMarks({})}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          Clear all
        </button>
      </div>

      <ul className="divide-y divide-white/10">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-slate-200">{member.fullName}</span>
            <select
              aria-label={`Attendance for ${member.fullName}`}
              value={marks[member.id] ?? ''}
              disabled={disabled}
              onChange={(event) =>
                setMarks((current) => {
                  const next = { ...current };
                  if (event.target.value) next[member.id] = event.target.value;
                  else delete next[member.id];
                  return next;
                })
              }
              className={`${inputClass} w-40`}
            >
              <option value="">Not marked</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.toLowerCase()}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <SubmitButton pendingLabel="Saving...">Save attendance ({records.length})</SubmitButton>
    </form>
  );
}
