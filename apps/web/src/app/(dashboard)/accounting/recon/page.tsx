import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { can, loadPrincipal } from '@/lib/principal';
import { BankAccountForm } from '@/components/accounting/recon-forms';
import { Card, EmptyState, PageHeader, SectionHeading } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Bank reconciliation' };

export default async function ReconPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view bank reconciliation." />;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);
  const [banks, accounts] = await Promise.all([
    api.listBankAccounts(token, { limit: 50, offset: 0 }),
    canManage
      ? api.listAccounts(token, { limit: 200, offset: 0 })
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof api.listAccounts>>['items'] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank reconciliation"
        description="Match statement lines to posted journals. Completion requires a zero difference."
      />

      {canManage ? (
        <Card>
          <SectionHeading title="New bank account" />
          <div className="mt-4">
            <BankAccountForm accounts={accounts.items} />
          </div>
        </Card>
      ) : null}

      {banks.items.length === 0 ? (
        <EmptyState message="No bank accounts yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {banks.items.map((bank) => (
            <li key={bank.id}>
              <Link
                href={`/accounting/recon/${bank.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div>
                  <p className="font-medium">{bank.name}</p>
                  <p className="text-sm text-slate-400">
                    {bank.institution ?? 'Bank'} · {bank.glAccountCode} {bank.glAccountName}
                    {bank.accountNumberMasked ? ` · ${bank.accountNumberMasked}` : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
