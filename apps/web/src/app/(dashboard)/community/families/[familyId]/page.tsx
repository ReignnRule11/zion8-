import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { removeFamilyMemberAction } from '../../actions';
import { Badge, Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { FamilyMemberForm } from '@/components/membership/join-forms';

export const metadata: Metadata = { title: 'Family' };

export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { familyId } = await params;

  if (!can(me, Permission.FAMILY_READ)) {
    return <EmptyState message="You do not have permission to view families." />;
  }

  let family;
  try {
    family = await api.getFamily(token, familyId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'FAMILY_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.FAMILY_MANAGE);
  const members = canManage
    ? (await api.listMembers(token, { limit: 200, offset: 0 })).items.map((member) => ({
        id: member.id,
        fullName: member.fullName,
      }))
    : [];
  const existingIds = family.members.map((member) => member.memberId);

  return (
    <div className="space-y-6">
      <Link
        href="/community/families"
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← Back to families
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{family.name}</h1>
        <StatusBadge status={family.status} />
      </header>

      <Card>
        <SectionHeading title="Household details" />
        <div className="mt-4">
          <DefinitionList
            items={[
              {
                term: 'Address',
                value:
                  [family.addressLine1, family.city, family.countryCode]
                    .filter(Boolean)
                    .join(', ') || '—',
              },
              { term: 'Home phone', value: family.homePhone ?? '—' },
            ]}
          />
          {family.notes ? (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-300">
              {family.notes}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Members"
          description={`${family.members.length} in this household`}
        />
        <ul className="mt-4 divide-y divide-white/10">
          {family.members.length === 0 ? (
            <li className="py-3 text-sm text-slate-400">No members yet.</li>
          ) : (
            family.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <Link
                  href={`/people/${member.memberId}`}
                  className="text-sm text-slate-200 hover:text-zion-200"
                >
                  {member.memberName}
                </Link>
                <div className="flex items-center gap-3">
                  <Badge tone="info">{humanize(member.role)}</Badge>
                  {canManage ? (
                    <ConfirmActionButton
                      action={removeFamilyMemberAction}
                      fields={{ familyId: family.id, memberId: member.memberId }}
                      pendingLabel="Removing..."
                      confirmMessage="Remove this member from the family?"
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
            <FamilyMemberForm
              familyId={family.id}
              members={members}
              excludeIds={existingIds}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
