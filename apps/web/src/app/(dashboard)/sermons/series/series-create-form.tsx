'use client';

import { useActionState } from 'react';
import { SermonVisibility } from '@zion8/contracts';
import { createSermonSeriesAction } from '../actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

export function SeriesCreateForm() {
  const [state, formAction] = useActionState(createSermonSeriesAction, initialFormState);
  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="series-title">
          <input id="series-title" name="title" required maxLength={200} className={inputClass} />
        </Field>
        <Field label="Visibility" htmlFor="series-visibility">
          <select
            id="series-visibility"
            name="visibility"
            defaultValue="MEMBERS"
            className={inputClass}
          >
            {Object.values(SermonVisibility).map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Subtitle" htmlFor="series-subtitle">
        <input id="series-subtitle" name="subtitle" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts on" htmlFor="series-starts">
          <input id="series-starts" name="startsOn" type="date" className={inputClass} />
        </Field>
        <Field label="Ends on" htmlFor="series-ends">
          <input id="series-ends" name="endsOn" type="date" className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Creating...">Create series</SubmitButton>
    </form>
  );
}
