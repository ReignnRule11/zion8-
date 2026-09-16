'use client';

import { useActionState } from 'react';
import type { MemoryArtifactResponse } from '@zion8/contracts';
import { CaptureDatePrecision, MemoryArtifactKind } from '@zion8/contracts';
import { updateMemoryArtifactAction } from '@/app/(dashboard)/memory/actions';
import { initialFormState } from '@/lib/form-state';
import { toDateInputValue } from '@/lib/format';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

/**
 * Human curation. A person may correct what the engine derived — the title, the
 * date and its precision, the kind, the tags — but never the archived bytes,
 * which stay immutable behind the version history.
 */
export function ArtifactDetailsForm({ artifact }: { artifact: MemoryArtifactResponse }) {
  const [state, formAction] = useActionState(updateMemoryArtifactAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="artifactId" value={artifact.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="artifact-edit-title">
          <input
            id="artifact-edit-title"
            name="title"
            required
            maxLength={200}
            defaultValue={artifact.title}
            className={inputClass}
          />
        </Field>
        <Field label="Kind" htmlFor="artifact-edit-kind">
          <select
            id="artifact-edit-kind"
            name="kind"
            defaultValue={artifact.kind}
            className={inputClass}
          >
            {Object.values(MemoryArtifactKind).map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Captured on"
          htmlFor="artifact-edit-captured"
          hint="Clear the field to remove the date."
        >
          <input
            id="artifact-edit-captured"
            name="capturedAt"
            type="date"
            defaultValue={toDateInputValue(artifact.capturedAt)}
            className={inputClass}
          />
        </Field>
        <Field label="Date precision" htmlFor="artifact-edit-precision">
          <select
            id="artifact-edit-precision"
            name="datePrecision"
            defaultValue={artifact.datePrecision}
            className={inputClass}
          >
            {Object.values(CaptureDatePrecision).map((precision) => (
              <option key={precision} value={precision}>
                {precision.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Tags"
        htmlFor="artifact-edit-tags"
        hint="Comma separated; replaces the current tags."
      >
        <input
          id="artifact-edit-tags"
          name="tags"
          defaultValue={artifact.tags.join(', ')}
          className={inputClass}
        />
      </Field>

      <Field label="Description" htmlFor="artifact-edit-description">
        <textarea
          id="artifact-edit-description"
          name="description"
          rows={3}
          maxLength={4000}
          defaultValue={artifact.description ?? ''}
          className={inputClass}
        />
      </Field>

      <SubmitButton pendingLabel="Saving..." variant="secondary">
        Save details
      </SubmitButton>
    </form>
  );
}
