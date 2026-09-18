import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { can, loadPrincipal } from '@/lib/principal';
import { createMemberAction } from '../actions';
import { Card, EmptyState, PageHeader } from '@/components/membership/ui';
import { MemberForm } from '@/components/membership/member-form';

export const metadata: Metadata = { title: 'Add member' };

export default async function NewMemberPage() {
  const { me } = await loadPrincipal();

  if (!can(me, Permission.MEMBER_CREATE)) {
    return <EmptyState message="You do not have permission to add members." />;
  }

  return (
    <div className="space-y-6">
      <Link href="/people" className="text-sm text-slate-400 transition hover:text-slate-200">
        ← Back to members
      </Link>
      <PageHeader
        title="Add member"
        description="Create a pastoral record. An account is optional and can be linked later."
      />
      <Card>
        <MemberForm action={createMemberAction} />
      </Card>
    </div>
  );
}
