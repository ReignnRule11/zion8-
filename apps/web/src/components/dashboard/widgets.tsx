import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AttendanceSessionKind,
  type AttendanceSessionSummary,
  type VolunteerRoleSummary,
} from '@zion8/contracts';
import {
  Badge,
  Card,
  EmptyState,
  inputClass,
  StatusBadge,
} from '@/components/membership/ui';
import type { ActivityItem, DashboardFilters, WeeklyPoint } from '@/lib/dashboard';
import { formatDate, formatDateTime, formatMoney, humanize } from '@/lib/format';
import { BarChart, Meter, Sparkline } from './charts';

export function DashboardFiltersForm({ filters }: { filters: DashboardFilters }) {
  return (
    <Card className="!p-4">
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Dashboard filters">
        <div className="space-y-1.5">
          <label htmlFor="from" className="text-xs uppercase tracking-wide text-slate-500">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="to" className="text-xs uppercase tracking-wide text-slate-500">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={filters.to} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="kind" className="text-xs uppercase tracking-wide text-slate-500">
            Session kind
          </label>
          <select id="kind" name="kind" defaultValue={filters.kind ?? ''} className={inputClass}>
            <option value="">Any kind</option>
            {Object.values(AttendanceSessionKind).map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
        >
          Apply range
        </button>
      </form>
    </Card>
  );
}

export function KpiTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]"
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Link>
  );
}

export function WidgetFrame({
  id,
  title,
  description,
  href,
  children,
}: {
  id: string;
  title: string;
  description: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <article aria-labelledby={id}>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={id} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          <Link href={href} className="text-sm text-zion-200 transition hover:text-zion-100">
            Open
          </Link>
        </div>
        <div className="mt-5">{children}</div>
      </Card>
    </article>
  );
}

export function AttendanceWidget({
  sessions,
  series,
  total,
}: {
  sessions: AttendanceSessionSummary[];
  series: WeeklyPoint[];
  total: number;
}) {
  return (
    <WidgetFrame
      id="widget-attendance"
      title="Attendance"
      description={`${total} people counted across ${sessions.length} sessions in this range.`}
      href="/community/attendance"
    >
      {sessions.length === 0 ? (
        <EmptyState message="No sessions in this range." hint="Record a service to start the series." />
      ) : (
        <div className="space-y-4">
          <Sparkline points={series} label="Weekly attendance" />
          <ul className="divide-y divide-white/10">
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(session.occurredAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums text-slate-300">{session.attendedCount}</span>
                  <Badge>{humanize(session.kind)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetFrame>
  );
}

export function GivingWidget({
  netMinor,
  currency,
  bars,
}: {
  netMinor: number;
  currency: string;
  bars: WeeklyPoint[];
}) {
  return (
    <WidgetFrame
      id="widget-giving"
      title="Giving"
      description="Posted gifts minus refunds, from the giving statement."
      href="/accounting/giving"
    >
      <p className="text-2xl font-semibold tabular-nums">{formatMoney(netMinor, currency)}</p>
      <div className="mt-4">
        {bars.length === 0 ? (
          <EmptyState message="No posted giving in this range." />
        ) : (
          <BarChart
            points={bars}
            label="Giving by fund"
            formatValue={(value) => formatMoney(value, currency)}
          />
        )}
      </div>
    </WidgetFrame>
  );
}

export function GrowthWidget({
  activeTotal,
  joinedTotal,
  visitorTotal,
}: {
  activeTotal: number;
  joinedTotal: number;
  visitorTotal: number | null;
}) {
  return (
    <WidgetFrame
      id="widget-growth"
      title="Growth"
      description="Active congregation, new joins in range, and the visitor pipeline."
      href="/people"
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Active members</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{activeTotal}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Joined in range</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{joinedTotal}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Visitors</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {visitorTotal === null ? '—' : visitorTotal}
          </dd>
        </div>
      </dl>
    </WidgetFrame>
  );
}

export function VolunteerHealthWidget({ roles }: { roles: VolunteerRoleSummary[] }) {
  const open = roles.reduce((sum, role) => sum + role.openSlots, 0);
  return (
    <WidgetFrame
      id="widget-volunteers"
      title="Volunteer health"
      description={`${open} open slots across ${roles.length} active roles.`}
      href="/community/volunteers"
    >
      {roles.length === 0 ? (
        <EmptyState message="No active volunteer roles." />
      ) : (
        <ul className="space-y-4">
          {roles.slice(0, 6).map((role) => (
            <li key={role.id}>
              <Meter
                value={role.activeCount}
                max={role.requiredCount}
                label={`${role.name}${role.departmentName ? ` · ${role.departmentName}` : ''}`}
              />
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

export function UpcomingSessionsWidget({
  sessions,
}: {
  sessions: AttendanceSessionSummary[];
}) {
  return (
    <WidgetFrame
      id="widget-upcoming"
      title="Upcoming sessions"
      description="Future attendance sessions. The events calendar is not shipped yet."
      href="/community/attendance"
    >
      {sessions.length === 0 ? (
        <EmptyState message="No upcoming sessions." hint="Schedule a service or class to see it here." />
      ) : (
        <ul className="divide-y divide-white/10">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{session.title}</p>
                <p className="text-xs text-slate-500">{formatDateTime(session.occurredAt)}</p>
              </div>
              <StatusBadge status={session.status} />
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

export function ArchiveTimelineWidget({
  items,
}: {
  items: Array<{ id: string; title: string; capturedAt: string | null; createdAt: string; kind: string }>;
}) {
  return (
    <WidgetFrame
      id="widget-archive"
      title="Historical timeline"
      description="Newest artifacts in the church archive for this range."
      href="/memory"
    >
      {items.length === 0 ? (
        <EmptyState message="No archive artifacts in this range." />
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border-l border-white/15 pl-3">
              <Link href={`/memory/${item.id}`} className="block hover:text-zion-100">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(item.capturedAt ?? item.createdAt)} · {humanize(item.kind)}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </WidgetFrame>
  );
}

export function RecentActivityWidget({ items }: { items: ActivityItem[] }) {
  return (
    <WidgetFrame
      id="widget-activity"
      title="Recent activity"
      description="Merged from lists this role can already read."
      href="/home"
    >
      {items.length === 0 ? (
        <EmptyState message="Nothing in this range yet." />
      ) : (
        <ul className="divide-y divide-white/10">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 py-2.5 transition hover:text-zion-100"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {item.source} · {item.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{formatDate(item.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

export function UnavailableWidget({
  id,
  title,
  reason,
}: {
  id: string;
  title: string;
  reason: string;
}) {
  return (
    <article aria-labelledby={id}>
      <Card>
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{reason}</p>
      </Card>
    </article>
  );
}
