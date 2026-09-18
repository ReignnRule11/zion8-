'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { MemberImportJob } from '@zion8/contracts';
import { commitMemberImportAction, previewMemberImportAction } from '@/app/onboarding/actions';
import { initialOnboardingState } from '@/app/onboarding/state';
import { FormFeedback, hintClass, inputClass, labelClass } from './ui';
import { SubmitButton } from './submit-button';

function CommitButton({ rows }: { rows: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Importing members...' : `Import ${rows.toLocaleString('en-US')} members`}
    </button>
  );
}

const STATUS_STYLES: Record<string, string> = {
  READY: 'text-zion-200',
  IMPORTING: 'text-zion-200',
  COMPLETED: 'text-emerald-200',
  PARTIAL: 'text-amber-200',
  FAILED: 'text-red-200',
  CANCELLED: 'text-slate-400',
};

export function MemberImportForm({
  jobs,
  disabled,
}: {
  jobs: MemberImportJob[];
  disabled: boolean;
}) {
  const [previewState, previewAction] = useActionState(
    previewMemberImportAction,
    initialOnboardingState,
  );
  const [commitState, commitAction] = useActionState(
    commitMemberImportAction,
    initialOnboardingState,
  );
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');

  const job = previewState.job;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
  }

  return (
    <div className="space-y-8">
      <form action={previewAction} className="space-y-4">
        <FormFeedback state={previewState} />

        <fieldset className="space-y-4" disabled={disabled}>
          <legend className={labelClass}>Upload a CSV</legend>
          <div className="space-y-1.5">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border file:border-white/15 file:bg-white/5 file:px-3 file:py-2 file:text-sm file:text-slate-200"
            />
            <p className={hintClass}>
              Columns: first_name, last_name, email, phone, role, joined_at.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="csv" className={labelClass}>
              Or paste CSV data
            </label>
            <textarea
              id="csv"
              name="csv"
              rows={6}
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              placeholder="first_name,last_name,email,role"
              className={`${inputClass} font-mono`}
            />
          </div>
        </fieldset>

        <input type="hidden" name="fileName" value={fileName} />
        <SubmitButton pendingLabel="Checking rows...">
          {job && job.status === 'READY' ? 'Re-check rows' : 'Preview import'}
        </SubmitButton>
      </form>

      <FormFeedback state={commitState} />

      {job ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {job.fileName ?? 'Pasted data'}
              </h3>
              <p className="text-xs text-slate-400">
                {job.totalRows} rows · {job.validRows} ready · {job.invalidRows} with problems
              </p>
            </div>
            <span
              className={`text-xs font-medium uppercase tracking-wide ${
                STATUS_STYLES[job.status] ?? 'text-slate-300'
              }`}
            >
              {job.status.replaceAll('_', ' ')}
            </span>
          </div>

          {job.issues.length > 0 ? (
            <ul className="max-h-48 space-y-1 overflow-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
              {job.issues.slice(0, 50).map((issue, index) => (
                <li key={`${issue.row}-${index}`}>
                  Row {issue.row}
                  {issue.field ? ` · ${issue.field}` : ''}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}

          {previewState.preview && previewState.preview.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4">First name</th>
                    <th className="pb-2 pr-4">Last name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {previewState.preview.map((row, index) => (
                    <tr key={index}>
                      <td className="py-2 pr-4">{row.firstName ?? ''}</td>
                      <td className="py-2 pr-4">{row.lastName ?? ''}</td>
                      <td className="py-2 pr-4 text-slate-400">{row.email ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-400">
                        {row.role?.replaceAll('_', ' ') ?? 'Member'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {job.validRows > 0 && job.status !== 'COMPLETED' ? (
            <form action={commitAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <CommitButton rows={job.validRows} />
            </form>
          ) : null}
        </section>
      ) : null}

      {jobs.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-200">Import history</h3>
          <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.02]">
            {jobs.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-300">{entry.fileName ?? 'Pasted data'}</span>
                <span className="text-xs text-slate-400">
                  {entry.importedRows}/{entry.totalRows} imported ·{' '}
                  <span className={STATUS_STYLES[entry.status] ?? 'text-slate-300'}>
                    {entry.status.toLowerCase()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
