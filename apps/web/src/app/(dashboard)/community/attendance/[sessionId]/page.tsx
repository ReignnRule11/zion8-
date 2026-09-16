import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDateTime, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { closeAttendanceSessionAction } from '../../actions';
import {
  Badge,
  Card,
  DefinitionList,
  EmptyState,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { AttendanceRosterForm } from '@/components/membership/attendance-roster-form';

export const metadata: Metadata = { title: 'Attendance session' };

export default async function AttendanceSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { sessionId } = await params;

  if (!can(me, Permission.ATTENDANCE_READ)) {
    return <EmptyState message="You do not have permission to view attendance." />;
  }

  let session;
  try {
    session = await api.getAttendanceSession(token, sessionId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'ATTENDANCE_SESSION_NOT_FOUND') {
      notFound();
    }
    throw error;
  }

  const canRecord = can(me, Permission.ATTENDANCE_RECORD);
  const open = session.status === 'OPEN';
  const members =
    canRecord && open
      ? (await api.listMembers(token, { limit: 200, offset: 0 })).items.map((member) => ({
          id: member.id,
          fullName: member.fullName,
        }))
      : [];

  return (
    <div className="space-y-6">
      <Link
        href="/community/attendance"
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← Back to attendance
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{formatDateTime(session.occurredAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{humanize(session.kind)}</Badge>
          <StatusBadge status={session.status} />
          {canRecord && open ? (
            <ConfirmActionButton
              action={closeAttendanceSessionAction}
              fields={{ sessionId: session.id }}
              pendingLabel="Closing..."
              confirmMessage="Close this session? Marking stops and the roster is locked."
              variant="secondary"
            >
              Close session
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      <Card>
        <SectionHeading title="Summary" />
        <div className="mt-4">
          <DefinitionList
            items={[
              { term: 'Attended', value: String(session.attendedCount) },
              { term: 'Absent', value: String(session.absentCount) },
              {
                term: 'Expected',
                value: session.expectedCount !== null ? String(session.expectedCount) : '—',
              },
              { term: 'Location', value: session.location ?? '—' },
            ]}
          />
        </div>
      </Card>

      {open && canRecord ? (
        <Card>
          <SectionHeading
            title="Roster"
            description="Mark everyone who attended, then save the sheet."
          />
          <div className="mt-4">
            <AttendanceRosterForm
              sessionId={session.id}
              members={members}
              existing={session.records.map((record) => ({
                memberId: record.memberId,
                status: record.status,
              }))}
              disabled={false}
            />
          </div>
        </Card>
      ) : (
        <Card>
          <SectionHeading title="Recorded attendance" description={`${session.records.length} records`} />
          <ul className="mt-4 divide-y divide-white/10">
            {session.records.length === 0 ? (
              <li className="py-3 text-sm text-slate-400">No records were saved.</li>
            ) : (
              session.records.map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-200">{record.attendeeName}</span>
                  <div className="flex items-center gap-3">
                    <Badge tone="neutral">{humanize(record.method)}</Badge>
                    <StatusBadge status={record.status} />
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
