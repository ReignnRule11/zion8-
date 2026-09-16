'use client';

import { useActionState } from 'react';
import type { BrandThemeResponse } from '@zion8/contracts';
import { saveBrandingAction } from '@/app/onboarding/actions';
import { initialOnboardingState } from '@/app/onboarding/state';
import { FormFeedback, hintClass, inputClass, labelClass } from './ui';
import { SubmitButton } from './submit-button';

const COLOR_FIELDS = [
  { name: 'primaryColor', label: 'Primary', fallback: '#4f46e5' },
  { name: 'secondaryColor', label: 'Secondary', fallback: '#0f172a' },
  { name: 'accentColor', label: 'Accent', fallback: '#38bdf8' },
] as const;

export function BrandingForm({
  theme,
  disabled,
}: {
  theme: BrandThemeResponse | null;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(saveBrandingAction, initialOnboardingState);

  return (
    <form action={formAction} className="space-y-6">
      <FormFeedback state={state} />

      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
        <legend className="sr-only">Brand identity</legend>
        <div className="space-y-1.5">
          <label htmlFor="displayName" className={labelClass}>
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            defaultValue={theme?.displayName ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tagline" className={labelClass}>
            Tagline
          </label>
          <input
            id="tagline"
            name="tagline"
            defaultValue={theme?.tagline ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="logoUrl" className={labelClass}>
            Logo URL
          </label>
          <input
            id="logoUrl"
            name="logoUrl"
            type="url"
            placeholder="https://cdn.gracechapel.org/logo.png"
            defaultValue={theme?.logoUrl ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="faviconUrl" className={labelClass}>
            Favicon URL
          </label>
          <input
            id="faviconUrl"
            name="faviconUrl"
            type="url"
            defaultValue={theme?.faviconUrl ?? ''}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="customDomain" className={labelClass}>
            Custom domain
          </label>
          <input
            id="customDomain"
            name="customDomain"
            placeholder="gracechapel.org"
            defaultValue={theme?.customDomain ?? ''}
            className={inputClass}
          />
          <p className={hintClass}>A domain you control, such as gracechapel.org.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className={labelClass}>Palette</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {COLOR_FIELDS.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label htmlFor={field.name} className={labelClass}>
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                type="color"
                defaultValue={theme?.[field.name] ?? field.fallback}
                className="h-11 w-full cursor-pointer rounded-lg border border-white/15 bg-white/5"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <div className="space-y-1.5">
          <label htmlFor="welcomeMessage" className={labelClass}>
            Welcome message
          </label>
          <textarea
            id="welcomeMessage"
            name="welcomeMessage"
            rows={3}
            defaultValue={theme?.welcomeMessage ?? ''}
            className={inputClass}
          />
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Saving...">Save brand</SubmitButton>
    </form>
  );
}
