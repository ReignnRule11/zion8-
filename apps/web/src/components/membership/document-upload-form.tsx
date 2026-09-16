'use client';

import { useActionState, useState } from 'react';
import { DocumentCategory } from '@zion8/contracts';
import { uploadDocumentAction } from '@/app/(dashboard)/people/actions';
import { initialFormState } from '@/lib/form-state';
import { Field, FormFeedback, hintClass, inputClass } from './ui';
import { SubmitButton } from './submit-button';

const MAX_BYTES = 524_288;
const CATEGORIES = Object.values(DocumentCategory);

/**
 * Documents are uploaded as base64 in the request body, so the bytes are encoded
 * in the browser. The profile page shows metadata; the bytes themselves are
 * streamed back through the web origin on download.
 */
export function DocumentUploadForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(uploadDocumentAction, initialFormState);
  const [encoded, setEncoded] = useState('');
  const [meta, setMeta] = useState<{ name: string; type: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setEncoded('');
    setMeta(null);
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFileError('Files must be 512 KiB or smaller.');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    setEncoded(window.btoa(binary));
    setMeta({ name: file.name, type: file.type || 'application/octet-stream' });
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="fileName" value={meta?.name ?? ''} />
      <input type="hidden" name="contentType" value={meta?.type ?? ''} />
      <input type="hidden" name="contentBase64" value={encoded} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="document-title">
          <input id="document-title" name="title" required maxLength={200} className={inputClass} />
        </Field>
        <Field label="Category" htmlFor="document-category">
          <select
            id="document-category"
            name="category"
            defaultValue={DocumentCategory.OTHER}
            className={inputClass}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="File" htmlFor="document-file" hint="PDF, image, or Word document up to 512 KiB.">
        <input
          id="document-file"
          type="file"
          onChange={handleFile}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx"
          className="w-full cursor-pointer rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-slate-300"
        />
      </Field>
      {fileError ? <p className="text-xs text-red-300">{fileError}</p> : null}
      {meta ? <p className={hintClass}>{meta.name} ready to upload.</p> : null}

      <Field label="Notes" htmlFor="document-notes">
        <input id="document-notes" name="notes" maxLength={2000} className={inputClass} />
      </Field>

      <SubmitButton pendingLabel="Uploading...">Upload document</SubmitButton>
    </form>
  );
}
