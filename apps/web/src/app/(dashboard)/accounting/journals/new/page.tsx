import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { can, loadPrincipal } from '@/lib/principal';
import { JournalForm } from '@/components/accounting/ledger-forms';
import { Card, EmptyState, PageHeader } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'New journal' };

export default async function NewJournalPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_MANAGE)) {
    return <EmptyState message="You do not have permission to write journals." />;
  }
  const accounts = await api.listAccounts(token, { limit: 200, offset: 0 });

  return (
    <div className="space-y-6">
      <Link href="/accounting/journals" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to journals
      </Link>
      <PageHeader
        title="New journal"
        description="Debits must equal credits. The entry stays a draft until you post it."
      />
      <Card>
        <JournalForm accounts={accounts.items} />
      </Card>
    </div>
  );
}
