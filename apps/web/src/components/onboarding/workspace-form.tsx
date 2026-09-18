'use client';

import { useActionState, useState } from 'react';
import type { ChurchProfileResponse, DayOfWeek, ServiceTime } from '@zion8/contracts';
import { saveWorkspaceAction } from '@/app/onboarding/actions';
import { initialOnboardingState } from '@/app/onboarding/state';
import { FormFeedback, hintClass, inputClass, labelClass } from './ui';
import { SubmitButton } from './submit-button';

const DAYS: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const WEEK_START_OPTIONS: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'SATURDAY'];

function newService(): ServiceTime {
  return { day: 'SUNDAY', startTime: '09:00', endTime: '11:00', name: 'Sunday Service' };
}

export function WorkspaceForm({
  profile,
  disabled,
}: {
  profile: ChurchProfileResponse | null;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(saveWorkspaceAction, initialOnboardingState);
  const [services, setServices] = useState<ServiceTime[]>(profile?.serviceTimes ?? []);

  function updateService(index: number, patch: Partial<ServiceTime>) {
    setServices((current) =>
      current.map((service, position) => (position === index ? { ...service, ...patch } : service)),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <FormFeedback state={state} />

      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
        <legend className="sr-only">Church identity</legend>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="legalName" className={labelClass}>
            Registered legal name
          </label>
          <input
            id="legalName"
            name="legalName"
            defaultValue={profile?.legalName ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contactEmail" className={labelClass}>
            Contact email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={profile?.contactEmail ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contactPhone" className={labelClass}>
            Contact phone
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            placeholder="+2348031234567"
            defaultValue={profile?.contactPhone ?? ''}
            className={inputClass}
          />
          <p className={hintClass}>International format, for example +2348031234567.</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="websiteUrl" className={labelClass}>
            Website
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://gracechapel.org"
            defaultValue={profile?.websiteUrl ?? ''}
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
        <legend className="sr-only">Location</legend>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="addressLine1" className={labelClass}>
            Address
          </label>
          <input
            id="addressLine1"
            name="addressLine1"
            defaultValue={profile?.addressLine1 ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="addressLine2" className={labelClass}>
            Address line 2
          </label>
          <input
            id="addressLine2"
            name="addressLine2"
            defaultValue={profile?.addressLine2 ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="city" className={labelClass}>
            City
          </label>
          <input id="city" name="city" defaultValue={profile?.city ?? ''} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="region" className={labelClass}>
            State or region
          </label>
          <input
            id="region"
            name="region"
            defaultValue={profile?.region ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="postalCode" className={labelClass}>
            Postal code
          </label>
          <input
            id="postalCode"
            name="postalCode"
            defaultValue={profile?.postalCode ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="countryCode" className={labelClass}>
            Country code
          </label>
          <input
            id="countryCode"
            name="countryCode"
            maxLength={2}
            placeholder="NG"
            defaultValue={profile?.countryCode ?? ''}
            className={inputClass}
          />
          <p className={hintClass}>Two-letter ISO code.</p>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3" disabled={disabled}>
        <legend className="sr-only">Operations</legend>
        <div className="space-y-1.5">
          <label htmlFor="estimatedMembers" className={labelClass}>
            Estimated members
          </label>
          <input
            id="estimatedMembers"
            name="estimatedMembers"
            type="number"
            min={0}
            defaultValue={profile?.estimatedMembers ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="currency" className={labelClass}>
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            maxLength={3}
            placeholder="USD"
            defaultValue={profile?.currency ?? 'USD'}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="weekStart" className={labelClass}>
            Week starts on
          </label>
          <select
            id="weekStart"
            name="weekStart"
            defaultValue={profile?.weekStart ?? 'SUNDAY'}
            className={inputClass}
          >
            {WEEK_START_OPTIONS.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className={labelClass}>Service times</legend>
        <input type="hidden" name="serviceTimes" value={JSON.stringify(services)} />
        {services.length === 0 ? (
          <p className={hintClass}>Add the services you hold each week.</p>
        ) : (
          <ul className="space-y-3">
            {services.map((service, index) => (
              <li
                key={index}
                className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[8rem_1fr_1fr_1fr_auto]"
              >
                <select
                  aria-label="Day"
                  value={service.day}
                  onChange={(event) =>
                    updateService(index, { day: event.target.value as DayOfWeek })
                  }
                  className={inputClass}
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day.charAt(0) + day.slice(1, 3).toLowerCase()}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Name"
                  value={service.name}
                  onChange={(event) => updateService(index, { name: event.target.value })}
                  className={inputClass}
                />
                <input
                  aria-label="Start time"
                  type="time"
                  value={service.startTime}
                  onChange={(event) => updateService(index, { startTime: event.target.value })}
                  className={inputClass}
                />
                <input
                  aria-label="End time"
                  type="time"
                  value={service.endTime ?? ''}
                  onChange={(event) => updateService(index, { endTime: event.target.value })}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    setServices((current) => current.filter((_, position) => position !== index))
                  }
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setServices((current) => [...current, newService()])}
          disabled={services.length >= 20}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          Add a service
        </button>
      </fieldset>

      <SubmitButton pendingLabel="Saving...">Save church profile</SubmitButton>
    </form>
  );
}
