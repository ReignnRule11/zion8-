'use client';

import { useActionState } from 'react';
import {
  MemberGender,
  MemberStatus,
  MaritalStatus,
  type MemberResponse,
} from '@zion8/contracts';
import { initialFormState, type FormState } from '@/lib/form-state';
import { toDateInputValue } from '@/lib/format';
import { Field, FormFeedback, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const STATUS_OPTIONS = Object.values(MemberStatus);
const GENDER_OPTIONS = Object.values(MemberGender);
const MARITAL_OPTIONS = Object.values(MaritalStatus);

function optionLabel(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

/**
 * One form serves both create and edit. The only differences are the server
 * action it posts to, whether the record id travels along, and the button copy —
 * so the field set, layout, and validation feedback stay identical.
 */
export function MemberForm({
  action,
  member,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  member?: MemberResponse;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const editing = Boolean(member);

  return (
    <form action={formAction} className="space-y-8">
      <FormFeedback state={state} />
      {member ? <input type="hidden" name="memberId" value={member.id} /> : null}

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Identity</legend>
        <Field label="First name" htmlFor="firstName">
          <input
            id="firstName"
            name="firstName"
            required
            defaultValue={member?.firstName ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Middle name" htmlFor="middleName">
          <input
            id="middleName"
            name="middleName"
            defaultValue={member?.middleName ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <input
            id="lastName"
            name="lastName"
            required
            defaultValue={member?.lastName ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Preferred name" htmlFor="preferredName">
          <input
            id="preferredName"
            name="preferredName"
            defaultValue={member?.preferredName ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Date of birth" htmlFor="dateOfBirth">
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={toDateInputValue(member?.dateOfBirth)}
            className={inputClass}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={member?.status ?? MemberStatus.ACTIVE}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {optionLabel(status)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Gender" htmlFor="gender">
          <select
            id="gender"
            name="gender"
            defaultValue={member?.gender ?? MemberGender.UNDISCLOSED}
            className={inputClass}
          >
            {GENDER_OPTIONS.map((gender) => (
              <option key={gender} value={gender}>
                {optionLabel(gender)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marital status" htmlFor="maritalStatus">
          <select
            id="maritalStatus"
            name="maritalStatus"
            defaultValue={member?.maritalStatus ?? MaritalStatus.UNDISCLOSED}
            className={inputClass}
          >
            {MARITAL_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {optionLabel(status)}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Contact</legend>
        <Field
          label="Email"
          htmlFor="email"
          hint="Used for giving receipts and follow-up."
          className="sm:col-span-1"
        >
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={member?.email ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Phone" htmlFor="phone" hint="International format, for example +2348031234567.">
          <input
            id="phone"
            name="phone"
            defaultValue={member?.phone ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Photo URL" htmlFor="photoUrl">
          <input
            id="photoUrl"
            name="photoUrl"
            type="url"
            defaultValue={member?.photoUrl ?? ''}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Address</legend>
        <Field label="Address line 1" htmlFor="addressLine1">
          <input
            id="addressLine1"
            name="addressLine1"
            defaultValue={member?.addressLine1 ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Address line 2" htmlFor="addressLine2">
          <input
            id="addressLine2"
            name="addressLine2"
            defaultValue={member?.addressLine2 ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="City" htmlFor="city">
          <input id="city" name="city" defaultValue={member?.city ?? ''} className={inputClass} />
        </Field>
        <Field label="State or region" htmlFor="region">
          <input
            id="region"
            name="region"
            defaultValue={member?.region ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Postal code" htmlFor="postalCode">
          <input
            id="postalCode"
            name="postalCode"
            defaultValue={member?.postalCode ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Country code" htmlFor="countryCode" hint="Two-letter ISO code.">
          <input
            id="countryCode"
            name="countryCode"
            maxLength={2}
            placeholder="NG"
            defaultValue={member?.countryCode ?? ''}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Membership</legend>
        <Field label="Joined on" htmlFor="joinedAt">
          <input
            id="joinedAt"
            name="joinedAt"
            type="date"
            defaultValue={toDateInputValue(member?.joinedAt)}
            className={inputClass}
          />
        </Field>
        <Field label="Baptized on" htmlFor="baptizedAt">
          <input
            id="baptizedAt"
            name="baptizedAt"
            type="date"
            defaultValue={toDateInputValue(member?.baptizedAt)}
            className={inputClass}
          />
        </Field>
        <Field label="Tags" htmlFor="tags" hint="Comma separated, for example choir, usher.">
          <input
            id="tags"
            name="tags"
            defaultValue={member?.tags.join(', ') ?? ''}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <Field label="Pastoral notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={member?.notes ?? ''}
          className={inputClass}
        />
      </Field>

      <SubmitButton pendingLabel={editing ? 'Saving...' : 'Creating...'}>
        {editing ? 'Save changes' : 'Create member'}
      </SubmitButton>
    </form>
  );
}
