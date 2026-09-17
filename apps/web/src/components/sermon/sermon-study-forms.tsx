'use client';

import { useActionState } from 'react';
import { SermonGenerateKind, SermonStage } from '@zion8/contracts';
import {
  createSermonNoteAction,
  createSermonShareAction,
  generateSermonAction,
  reprocessSermonAction,
  upsertTranscriptAction,
} from '@/app/(dashboard)/sermons/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

export function SermonReprocessForm({ sermonId }: { sermonId: string }) {
  const [state, formAction] = useActionState(reprocessSermonAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <input type="hidden" name="sermonId" value={sermonId} />
      <fieldset className="grid gap-2 sm:grid-cols-3">
        {Object.values(SermonStage).map((stage) => (
          <label key={stage} className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="stages"
              value={stage}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            {stage.toLowerCase()}
          </label>
        ))}
      </fieldset>
      <SubmitButton pendingLabel="Queueing..." variant="secondary">
        Reprocess
      </SubmitButton>
    </form>
  );
}

export function SermonGenerateForm({ sermonId }: { sermonId: string }) {
  const [state, formAction] = useActionState(generateSermonAction, initialFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FormFeedback state={state} />
      <input type="hidden" name="sermonId" value={sermonId} />
      <Field label="Generate" htmlFor="sermon-generate-kind">
        <select id="sermon-generate-kind" name="kind" className={inputClass} defaultValue="SUMMARY">
          {Object.values(SermonGenerateKind).map((kind) => (
            <option key={kind} value={kind}>
              {kind.toLowerCase()}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton pendingLabel="Generating..." variant="secondary">
        Generate
      </SubmitButton>
    </form>
  );
}

export function SermonTranscriptForm({
  sermonId,
  language,
  text,
}: {
  sermonId: string;
  language: string;
  text: string;
}) {
  const [state, formAction] = useActionState(upsertTranscriptAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <input type="hidden" name="sermonId" value={sermonId} />
      <input type="hidden" name="language" value={language} />
      <textarea name="text" rows={10} defaultValue={text} className={inputClass} required />
      <SubmitButton pendingLabel="Saving...">Save transcript</SubmitButton>
    </form>
  );
}

export function SermonNoteForm({ sermonId }: { sermonId: string }) {
  const [state, formAction] = useActionState(createSermonNoteAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormFeedback state={state} />
      <input type="hidden" name="sermonId" value={sermonId} />
      <textarea name="body" rows={3} required className={inputClass} placeholder="A note while listening" />
      <SubmitButton pendingLabel="Saving..." variant="secondary">
        Add note
      </SubmitButton>
    </form>
  );
}

export function SermonShareForm({ sermonId }: { sermonId: string }) {
  const [state, formAction] = useActionState(createSermonShareAction, initialFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FormFeedback state={state} />
      <input type="hidden" name="sermonId" value={sermonId} />
      <Field label="Expires in days" htmlFor="share-days">
        <input id="share-days" name="expiresInDays" type="number" min={1} max={365} className={inputClass} />
      </Field>
      <SubmitButton pendingLabel="Creating..." variant="secondary">
        Create share link
      </SubmitButton>
    </form>
  );
}
