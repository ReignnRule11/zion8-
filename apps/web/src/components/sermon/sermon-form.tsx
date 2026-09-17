'use client';

import { useActionState, useState } from 'react';
import {
  MAX_SERMON_MEDIA_BYTES,
  SermonVisibility,
  type SermonResponse,
  type SermonSeriesSummary,
} from '@zion8/contracts';
import { createSermonAction, updateSermonAction } from '@/app/(dashboard)/sermons/actions';
import { initialFormState } from '@/lib/form-state';
import { toDateTimeInputValue } from '@/lib/format';
import { Field, FormFeedback, hintClass, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

const VISIBILITIES = Object.values(SermonVisibility);
const MAX_MIB = (MAX_SERMON_MEDIA_BYTES / 1024 / 1024).toFixed(0);

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

export function SermonForm({
  series,
  sermon,
}: {
  series: SermonSeriesSummary[];
  sermon?: SermonResponse;
}) {
  const action = sermon ? updateSermonAction : createSermonAction;
  const [state, formAction] = useActionState(action, initialFormState);
  const [encoded, setEncoded] = useState('');
  const [meta, setMeta] = useState<{ name: string; type: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setEncoded('');
    setMeta(null);
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_SERMON_MEDIA_BYTES) {
      setFileError(`Files must be ${MAX_MIB} MiB or smaller.`);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    setEncoded(toBase64(bytes));
    setMeta({ name: file.name, type: file.type || 'application/octet-stream' });
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      {sermon ? <input type="hidden" name="sermonId" value={sermon.id} /> : null}
      {!sermon ? (
        <>
          <input type="hidden" name="fileName" value={meta?.name ?? ''} />
          <input type="hidden" name="contentType" value={meta?.type ?? ''} />
          <input type="hidden" name="contentBase64" value={encoded} />
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="sermon-title">
          <input
            id="sermon-title"
            name="title"
            required
            maxLength={200}
            defaultValue={sermon?.title}
            className={inputClass}
          />
        </Field>
        <Field label="Speaker" htmlFor="sermon-speaker">
          <input
            id="sermon-speaker"
            name="speakerName"
            defaultValue={sermon?.speakerName ?? ''}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Subtitle" htmlFor="sermon-subtitle">
        <input
          id="sermon-subtitle"
          name="subtitle"
          defaultValue={sermon?.subtitle ?? ''}
          className={inputClass}
        />
      </Field>

      <Field label="Description" htmlFor="sermon-description">
        <textarea
          id="sermon-description"
          name="description"
          rows={4}
          defaultValue={sermon?.description ?? ''}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Series" htmlFor="sermon-series">
          <select
            id="sermon-series"
            name="seriesId"
            defaultValue={sermon?.series?.id ?? ''}
            className={inputClass}
          >
            <option value="">No series</option>
            {series.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visibility" htmlFor="sermon-visibility">
          <select
            id="sermon-visibility"
            name="visibility"
            defaultValue={sermon?.visibility ?? 'MEMBERS'}
            className={inputClass}
          >
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preached at" htmlFor="sermon-preached">
          <input
            id="sermon-preached"
            name="preachedAt"
            type="datetime-local"
            defaultValue={toDateTimeInputValue(sermon?.preachedAt)}
            className={inputClass}
          />
        </Field>
        <Field label="Location" htmlFor="sermon-location">
          <input
            id="sermon-location"
            name="location"
            defaultValue={sermon?.location ?? ''}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Tags" htmlFor="sermon-tags" hint="Comma separated">
        <input
          id="sermon-tags"
          name="tags"
          defaultValue={sermon?.tags.join(', ') ?? ''}
          className={inputClass}
        />
      </Field>

      {!sermon ? (
        <>
          <Field label="Recording or manuscript" htmlFor="sermon-file">
            <input
              id="sermon-file"
              type="file"
              accept="audio/*,video/*,text/plain,text/markdown,application/pdf"
              onChange={handleFile}
              className={inputClass}
            />
            <p className={hintClass}>
              Optional. Audio, video, plain text, markdown or PDF up to {MAX_MIB} MiB. Bytes are stored in Memory.
            </p>
            {fileError ? <p className="text-sm text-red-300">{fileError}</p> : null}
            {meta ? <p className="text-xs text-slate-400">{meta.name}</p> : null}
          </Field>
          <Field label="Transcript" htmlFor="sermon-transcript" hint="Paste text if there is no recording yet">
            <textarea id="sermon-transcript" name="transcriptText" rows={8} className={inputClass} />
          </Field>
        </>
      ) : null}

      <SubmitButton pendingLabel={sermon ? 'Saving...' : 'Creating...'}>
        {sermon ? 'Save sermon' : 'Create sermon'}
      </SubmitButton>
    </form>
  );
}
