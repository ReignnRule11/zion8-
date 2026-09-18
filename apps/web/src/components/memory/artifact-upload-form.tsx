'use client';

import { useActionState, useState } from 'react';
import { CaptureDatePrecision, MAX_ARTIFACT_BYTES, MemoryArtifactKind } from '@zion8/contracts';
import { createMemoryArtifactAction } from '@/app/(dashboard)/memory/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, hintClass, inputClass } from '@/components/membership/ui';
import { SubmitButton } from '@/components/membership/submit-button';

const KINDS = Object.values(MemoryArtifactKind);
const PRECISIONS = Object.values(CaptureDatePrecision);

const MAX_MIB = (MAX_ARTIFACT_BYTES / 1024 / 1024).toFixed(0);

/** Encodes bytes to base64 in chunks so a 4 MiB file does not stall the main thread. */
function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

/**
 * Ingests one artifact. The engine accepts any supported modality through the
 * same endpoint — a photograph, a scanned minute book, a sermon recording — and
 * works out the rest from the bytes and the metadata supplied here.
 */
export function ArtifactUploadForm() {
  const [state, formAction] = useActionState(createMemoryArtifactAction, initialFormState);
  const [encoded, setEncoded] = useState('');
  const [meta, setMeta] = useState<{ name: string; type: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setEncoded('');
    setMeta(null);
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_ARTIFACT_BYTES) {
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
      <input type="hidden" name="fileName" value={meta?.name ?? ''} />
      <input type="hidden" name="contentType" value={meta?.type ?? ''} />
      <input type="hidden" name="contentBase64" value={encoded} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="artifact-title">
          <input id="artifact-title" name="title" required maxLength={200} className={inputClass} />
        </Field>
        <Field label="Kind" htmlFor="artifact-kind">
          <select
            id="artifact-kind"
            name="kind"
            defaultValue={MemoryArtifactKind.OTHER}
            className={inputClass}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="File"
        htmlFor="artifact-file"
        hint={`Images, audio, video, PDF, or office documents up to ${MAX_MIB} MiB. Content is detected from the bytes, not the file name.`}
      >
        <input
          id="artifact-file"
          type="file"
          onChange={handleFile}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff,.gif,.mp3,.m4a,.wav,.ogg,.webm,.flac,.mp4,.mov,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.rtf"
          className="w-full cursor-pointer rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-slate-300"
        />
      </Field>
      {fileError ? <p className="text-xs text-red-300">{fileError}</p> : null}
      {meta ? <p className={hintClass}>{meta.name} ready to upload.</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Captured on" htmlFor="artifact-captured" hint="Leave blank when unknown.">
          <input id="artifact-captured" name="capturedAt" type="date" className={inputClass} />
        </Field>
        <Field
          label="Date precision"
          htmlFor="artifact-precision"
          hint="How exactly the date is known; the timeline never invents a day."
        >
          <select
            id="artifact-precision"
            name="datePrecision"
            defaultValue={CaptureDatePrecision.UNKNOWN}
            className={inputClass}
          >
            {PRECISIONS.map((precision) => (
              <option key={precision} value={precision}>
                {precision.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Tags" htmlFor="artifact-tags" hint="Comma separated.">
        <input
          id="artifact-tags"
          name="tags"
          className={inputClass}
          placeholder="1952, choir, anniversary"
        />
      </Field>

      <Field label="Description" htmlFor="artifact-description">
        <textarea
          id="artifact-description"
          name="description"
          rows={3}
          maxLength={4000}
          className={inputClass}
        />
      </Field>

      <SubmitButton pendingLabel="Uploading...">Add to memory</SubmitButton>
    </form>
  );
}
