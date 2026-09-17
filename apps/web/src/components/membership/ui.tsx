import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/form-state';
import { humanize, initials } from '@/lib/format';

export const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-zion-400 focus:ring-2 focus:ring-zion-500/30';

export const labelClass = 'block text-sm font-medium text-slate-200';

export const hintClass = 'text-xs text-slate-500';

export const selectClass = inputClass;

export function FormFeedback({ state }: { state: FormState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
      >
        <p>{state.message}</p>
        {state.issues && state.issues.length > 0 ? (
          <ul className="list-inside list-disc space-y-1 text-xs text-red-200/90">
            {state.issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                {issue.path ? <span className="font-medium">{issue.path}: </span> : null}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <p
      role="status"
      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {state.message}
    </p>
  );
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-white/15 bg-white/5 text-slate-300',
  info: 'border-zion-400/40 bg-zion-500/10 text-zion-200',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/40 bg-red-500/10 text-red-200',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  AVAILABLE: 'success',
  FRESH: 'success',
  PRESENT: 'success',
  READY: 'success',
  SUCCEEDED: 'success',
  OPEN: 'info',
  PROCESSING: 'info',
  RUNNING: 'info',
  PENDING: 'warning',
  FOLLOW_UP: 'warning',
  STALE: 'warning',
  LATE: 'warning',
  EXCUSED: 'warning',
  PAUSED: 'warning',
  PARTIAL: 'warning',
  BLOCKED: 'warning',
  NEW: 'info',
  RETURNING: 'info',
  INACTIVE: 'neutral',
  ARCHIVED: 'neutral',
  CLOSED: 'neutral',
  DORMANT: 'neutral',
  ABSENT: 'danger',
  FAILED: 'danger',
  DECEASED: 'danger',
  TRANSFERRED: 'neutral',
};

/** Maps a domain status onto a badge tone so lists read consistently. */
export function statusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'neutral';
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{humanize(status)}</Badge>;
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-6 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
      <p className="text-sm text-slate-300">{message}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Avatar({
  firstName,
  lastName,
  photoUrl,
  size = 'md',
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimensions = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg' };
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zion-500/20 font-semibold text-zion-100 ${dimensions[size]}`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(firstName, lastName)
      )}
    </span>
  );
}

function buildHref(basePath: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  limit,
  offset,
  total,
  filters = {},
}: {
  basePath: string;
  limit: number;
  offset: number;
  total: number;
  filters?: Record<string, string | undefined>;
}) {
  if (total <= limit) return null;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <p className="text-slate-400">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex gap-2">
        {hasPrevious ? (
          <Link
            href={buildHref(basePath, {
              ...filters,
              limit: String(limit),
              offset: String(Math.max(0, offset - limit)),
            })}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 transition hover:bg-white/10"
          >
            Previous
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            href={buildHref(basePath, { ...filters, limit: String(limit), offset: String(offset + limit) })}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 transition hover:bg-white/10"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = '',
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}

export function DefinitionList({
  items,
}: {
  items: Array<{ term: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term}>
          <dt className="text-xs uppercase tracking-wide text-slate-500">{item.term}</dt>
          <dd className="mt-1 text-sm text-slate-200">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
