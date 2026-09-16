import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { endVolunteerAssignmentAction } from '../../actions';
import { Badge, Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { VolunteerAssignmentForm } from '@/components/membership/join-forms';

export const metadata: Metadata = { title: 'Volunteer role' };

export default async function VolunteerRolePage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { roleId } = await params;

  if (!can(me, Permission.VOLUNTEER_READ)) {
    return <EmptyState message="You do not have permission to view volunteer roles." />;
  }

  let role;
  try {
    role = await api.getVolunteerRole(token, roleId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'VOLUNTEER_ROLE_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.VOLUNTEER_MANAGE);
  const members = canManage
    ? (await api.listMembers(token, { limit: 200, offset: 0 })).items.map((member) => ({
        id: member.id,
        fullName: member.fullName,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/community/volunteers"
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← Back to volunteers
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{role.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{humanize(role.commitment)} commitment</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={role.openSlots > 0 ? 'warning' : 'success'}>
            {role.activeCount}/{role.requiredCount} filled
          </Badge>
          <StatusBadge status={role.isActive ? 'ACTIVE' : 'INACTIVE'} />
        </div>
      </header>

      <Card>
        <SectionHeading title="Details" />
        <div className="mt-4">
          <DefinitionList
            items={[
              { term: 'Open slots', value: String(role.openSlots) },
              {
                term: 'Background check',
                value: role.requiresBackgroundCheck ? 'Required' : 'Not required',
              },
              { term: 'Department', value: role.departmentId ? 'Linked' : '—' },
            ]}
          />
          {role.description ? (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-300">
              {role.description}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Assignments"
          description={`${role.assignments.length} recorded`}
        />
        <ul className="mt-4 divide-y divide-white/10">
          {role.assignments.length === 0 ? (
            <li className="py-3 text-sm text-slate-400">No one is assigned yet.</li>
          ) : (
            role.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/people/${assignment.memberId}`}
                    className="text-sm text-slate-200 hover:text-zion-200"
                  >
                    {assignment.memberName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    Started {formatDate(assignment.startsAt)}
                    {assignment.endsAt ? ` · ended ${formatDate(assignment.endsAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={assignment.status} />
                  {canManage && assignment.status !== 'ENDED' ? (
                    <ConfirmActionButton
                      action={endVolunteerAssignmentAction}
                      fields={{ roleId: role.id, assignmentId: assignment.id }}
                      pendingLabel="Ending..."
                      confirmMessage="End this volunteer assignment?"
                      variant="secondary"
                    >
                      End
                    </ConfirmActionButton>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
        {canManage ? (
          <div className="mt-6 border-t border-white/10 pt-6">
            <VolunteerAssignmentForm roleId={role.id} members={members} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
