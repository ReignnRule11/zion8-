'use client';

import { useActionState } from 'react';
import { MemoryStage } from '@zion8/contracts';
import { reprocessMemoryArtifactAction } from '@/app/(dashboard)/memory/actions';
import { initialFormState } from '@/lib/form-state';
import { FormFeedback, hintClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

/**
 * Requests that the engine run processing stages again. Stages that need an
 * external capability (OCR, speech-to-text) become BLOCKED with a reason when the
 * deployment has not configured one, rather than pretending to have succeeded.
 */
export function ArtifactReprocessForm({ artifactId }: { artifactId: string }) {
  const [state, formAction] = useActionState(reprocessMemoryArtifactAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="artifactId" value={artifactId} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-200">
          Stages to run (leave all unchecked to run the pipeline defaults)
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.values(MemoryStage).map((stage) => (
            <label key={stage} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="stages"
                value={stage}
                className="h-4 w-4 rounded border-white/20 bg-white/5"
              />
              {stage.replaceAll('_', ' ').toLowerCase()}
            </label>
          ))}
        </div>
      </fieldset>

      <p className={hintClass}>
        Extraction and transcription are recorded as blocked until OCR and speech-to-text services
        are configured for this deployment.
      </p>

      <SubmitButton pendingLabel="Queueing..." variant="secondary">
        Reprocess artifact
      </SubmitButton>
    </form>
  );
}
