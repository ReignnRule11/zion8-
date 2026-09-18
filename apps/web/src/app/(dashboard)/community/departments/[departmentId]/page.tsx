import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { removeDepartmentMemberAction } from '../../actions';
import { Badge, Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { DepartmentMemberForm } from '@/components/membership/join-forms';

export const metadata: Metadata = { title: 'Department' };

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { departmentId } = await params;

  if (!can(me, Permission.DEPARTMENT_READ)) {
    return <EmptyState message="You do not have permission to view departments." />;
  }

  let department;
  try {
    department = await api.getDepartment(token, departmentId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'DEPARTMENT_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.DEPARTMENT_MANAGE);
  const members = canManage
    ? (await api.listMembers(token, { limit: 200, offset: 0 })).items.map((member) => ({
        id: member.id,
        fullName: member.fullName,
      }))
    : [];
  const existingIds = department.members.map((member) => member.memberId);

  return (
    <div className="space-y-6">
      <Link
        href="/community/departments"
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← Back to departments
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{department.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{humanize(department.kind)}</p>
        </div>
        <StatusBadge status={department.isActive ? 'ACTIVE' : 'INACTIVE'} />
      </header>

      <Card>
        <SectionHeading title="Details" />
        <div className="mt-4">
          <DefinitionList
            items={[
              { term: 'Leader', value: department.leaderMemberId ? 'Assigned' : '—' },
              { term: 'Meeting day', value: department.meetingDay ? humanize(department.meetingDay) : '—' },
              { term: 'Meeting time', value: department.meetingTime ?? '—' },
              { term: 'Location', value: department.location ?? '—' },
            ]}
          />
          {department.description ? (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-300">
              {department.description}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Members"
          description={`${department.members.length} serving`}
        />
        <ul className="mt-4 divide-y divide-white/10">
          {department.members.length === 0 ? (
            <li className="py-3 text-sm text-slate-400">No members yet.</li>
          ) : (
            department.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <Link
                  href={`/people/${member.memberId}`}
                  className="text-sm text-slate-200 hover:text-zion-200"
                >
                  {member.memberName}
                </Link>
                <div className="flex items-center gap-3">
                  <Badge tone="info">{humanize(member.role)}</Badge>
                  <StatusBadge status={member.status} />
                  {canManage ? (
                    <ConfirmActionButton
                      action={removeDepartmentMemberAction}
                      fields={{ departmentId: department.id, memberId: member.memberId }}
                      pendingLabel="Removing..."
                      confirmMessage="Remove this member from the department?"
                      variant="secondary"
                    >
                      Remove
                    </ConfirmActionButton>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
        {canManage ? (
          <div className="mt-6 border-t border-white/10 pt-6">
            <DepartmentMemberForm
              departmentId={department.id}
              members={members}
              excludeIds={existingIds}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
