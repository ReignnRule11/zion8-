import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AttendanceSessionKind,
  AttendanceSessionStatus,
  attendanceSessionKindSchema,
  attendanceSessionStatusSchema,
  Permission,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { createAttendanceSessionAction } from '../actions';
import {
  Badge,
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { AttendanceSessionForm } from '@/components/membership/attendance-session-form';

export const metadata: Metadata = { title: 'Attendance' };

const PAGE_SIZE = 25;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    kind?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ATTENDANCE_READ)) {
    return <EmptyState message="You do not have permission to view attendance." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const status = params.status
    ? attendanceSessionStatusSchema.safeParse(params.status.toUpperCase())
    : null;
  const kind = params.kind ? attendanceSessionKindSchema.safeParse(params.kind.toUpperCase()) : null;

  const canRecord = can(me, Permission.ATTENDANCE_RECORD);
  const [page, departmentPage] = await Promise.all([
    api.listAttendanceSessions(token, {
      limit,
      offset,
      status: status?.success ? status.data : undefined,
      kind: kind?.success ? kind.data : undefined,
    }),
    canRecord
      ? api.listDepartments(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] as Array<{ id: string; name: string }> }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Record who came to each service, class, and event."
      />

      {canRecord ? (
        <Card>
          <SectionHeading title="New session" />
          <div className="mt-4">
            <AttendanceSessionForm
              departments={departmentPage.items.map((department) => ({
                id: department.id,
                name: department.name,
              }))}
            />
          </div>
        </Card>
      ) : null}

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status?.success ? status.data : ''}
              className={inputClass}
            >
              <option value="">Any status</option>
              {Object.values(AttendanceSessionStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="kind" className="text-xs uppercase tracking-wide text-slate-500">
              Kind
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={kind?.success ? kind.data : ''}
              className={inputClass}
            >
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
            Apply filters
          </button>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <EmptyState message="No sessions recorded yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.items.map((session) => (
            <li key={session.id}>
              <Link
                href={`/community/attendance/${session.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{session.title}</p>
                  <p className="text-sm text-slate-400">
                    {formatDateTime(session.occurredAt)}
                    {session.location ? ` · ${session.location}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-slate-400">
                    <p>{session.attendedCount} attended</p>
                    {session.expectedCount ? <p>of {session.expectedCount} expected</p> : null}
                  </div>
                  <Badge>{humanize(session.kind)}</Badge>
                  <StatusBadge status={session.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/community/attendance"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{
          status: status?.success ? status.data : undefined,
          kind: kind?.success ? kind.data : undefined,
        }}
      />
    </div>
  );
}
