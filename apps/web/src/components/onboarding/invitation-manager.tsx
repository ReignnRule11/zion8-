'use client';

import { useActionState, useState } from 'react';
import { INVITABLE_ONBOARDING_ROLES, type InvitationSummary, type Role } from '@zion8/contracts';
import {
  inviteAdministratorsAction,
  resendInvitationAction,
  revokeInvitationAction,
} from '@/app/onboarding/actions';
import { initialOnboardingState } from '@/app/onboarding/state';
import { FormFeedback, hintClass, inputClass, labelClass } from './ui';
import { SubmitButton } from './submit-button';

interface InviteeRow {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

function newRow(): InviteeRow {
  return { email: '', firstName: '', lastName: '', role: 'ADMINISTRATOR' };
}

const ROLE_LABEL: Record<string, string> = {
  ADMINISTRATOR: 'Administrator',
  SENIOR_PASTOR: 'Senior Pastor',
  FINANCE_OFFICER: 'Finance Officer',
  MINISTRY_LEADER: 'Ministry Leader',
};

export function InvitationManager({
  invitations,
  disabled,
}: {
  invitations: InvitationSummary[];
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(inviteAdministratorsAction, initialOnboardingState);
  const [rows, setRows] = useState<InviteeRow[]>([newRow()]);

  function updateRow(index: number, patch: Partial<InviteeRow>) {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  const payload = JSON.stringify(
    rows
      .filter((row) => row.email.trim().length > 0)
      .map((row) => ({
        email: row.email.trim(),
        firstName: row.firstName.trim() || undefined,
        lastName: row.lastName.trim() || undefined,
        role: row.role,
      })),
  );

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4">
        <FormFeedback state={state} />
        <input type="hidden" name="invitations" value={payload} />

        <fieldset className="space-y-3" disabled={disabled}>
          <legend className={labelClass}>Invite administrators</legend>
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto]"
            >
              <input
                aria-label="Email"
                type="email"
                placeholder="pastor@gracechapel.org"
                value={row.email}
                onChange={(event) => updateRow(index, { email: event.target.value })}
                className={inputClass}
              />
              <input
                aria-label="First name"
                placeholder="First name"
                value={row.firstName}
                onChange={(event) => updateRow(index, { firstName: event.target.value })}
                className={inputClass}
              />
              <input
                aria-label="Last name"
                placeholder="Last name"
                value={row.lastName}
                onChange={(event) => updateRow(index, { lastName: event.target.value })}
                className={inputClass}
              />
              <select
                aria-label="Role"
                value={row.role}
                onChange={(event) => updateRow(index, { role: event.target.value as Role })}
                className={inputClass}
              >
                {INVITABLE_ONBOARDING_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role] ?? role.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setRows((current) =>
                    current.length === 1
                      ? [newRow()]
                      : current.filter((_, position) => position !== index),
                  )
                }
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
              >
                Remove
              </button>
            </div>
          ))}
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, newRow()])}
            disabled={disabled || rows.length >= 50}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            Add another
          </button>
          <SubmitButton pendingLabel="Sending...">Send invitations</SubmitButton>
        </div>
        <p className={hintClass}>
          Only roles below your own can be assigned. You can invite more people later.
        </p>
      </form>

      <section>
        <h3 className="text-sm font-semibold text-slate-200">Sent invitations</h3>
        {invitations.length === 0 ? (
          <p className={`mt-2 ${hintClass}`}>No invitations have been sent yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.02]">
            {invitations.map((invitation) => {
              const isOpen = invitation.status === 'PENDING';
              return (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{invitation.email}</p>
                    <p className="text-xs text-slate-400">
                      {ROLE_LABEL[invitation.role] ?? invitation.role.replaceAll('_', ' ')} ·{' '}
                      {invitation.status.toLowerCase()}
                      {invitation.resendCount > 0
                        ? ` · sent ${invitation.resendCount + 1} times`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <>
                        <form action={resendInvitationAction}>
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <SubmitButton variant="secondary" pendingLabel="Sending...">
                            Resend
                          </SubmitButton>
                        </form>
                        <form action={revokeInvitationAction}>
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <SubmitButton variant="danger" pendingLabel="Revoking...">
                            Revoke
                          </SubmitButton>
                        </form>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {invitation.status === 'ACCEPTED' ? 'Accepted' : 'Closed'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
