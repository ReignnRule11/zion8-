import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { can, loadPrincipal } from '@/lib/principal';
import { updateMemberAction } from '../../actions';
import { Card, EmptyState, PageHeader } from '@/components/membership/ui';
import { MemberForm } from '@/components/membership/member-form';

export const metadata: Metadata = { title: 'Edit member' };

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { memberId } = await params;

  if (!can(me, Permission.MEMBER_UPDATE)) {
    return <EmptyState message="You do not have permission to edit members." />;
  }

  let member;
  try {
    member = await api.getMember(token, memberId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'MEMBER_NOT_FOUND') notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/people/${member.id}`}
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← Back to profile
      </Link>
      <PageHeader
        title={`Edit ${member.firstName} ${member.lastName}`}
        description="Clearing an optional field removes it from the record."
      />
      <Card>
        <MemberForm action={updateMemberAction} member={member} />
      </Card>
    </div>
  );
}
