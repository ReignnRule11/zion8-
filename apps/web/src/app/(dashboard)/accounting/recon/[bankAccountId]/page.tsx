import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { BankTransactionForm, ReconciliationForm } from '@/components/accounting/recon-forms';
import { Card, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Bank account' };

export default async function BankAccountPage({
  params,
}: {
  params: Promise<{ bankAccountId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { bankAccountId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view bank reconciliation." />;
  }

  let bank;
  try {
    bank = await api.getBankAccount(token, bankAccountId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'BANK_ACCOUNT_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);
  const [transactions, reconciliations] = await Promise.all([
    api.listBankTransactions(token, bankAccountId, { limit: 50, offset: 0 }),
    api.listReconciliations(token, bankAccountId, { limit: 20, offset: 0 }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/accounting/recon" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to bank rec
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{bank.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {bank.institution ?? 'Bank'} · {bank.glAccountCode} {bank.glAccountName}
        </p>
      </header>

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeading title="Add statement line" />
            <div className="mt-4">
              <BankTransactionForm bankAccountId={bank.id} />
            </div>
          </Card>
          <Card>
            <SectionHeading title="Open reconciliation" />
            <div className="mt-4">
              <ReconciliationForm bankAccountId={bank.id} />
            </div>
          </Card>
        </div>
      ) : null}

      <Card>
        <SectionHeading title="Transactions" />
        {transactions.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No statement lines yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {transactions.items.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{txn.description}</p>
                  <p className="text-sm text-slate-400">
                    {formatDate(txn.occurredOn)} · {humanize(txn.kind)}
                    {txn.matchedJournalId ? ' · matched' : ' · unmatched'}
                  </p>
                </div>
                <span className="text-sm">{formatMoney(txn.amountMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeading title="Reconciliations" />
        {reconciliations.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No reconciliations yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {reconciliations.items.map((rec) => (
              <li key={rec.id}>
                <Link
                  href={`/accounting/recon/reconciliations/${rec.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition hover:text-zion-100"
                >
                  <div>
                    <p className="font-medium">Statement {formatDate(rec.statementOn)}</p>
                    <p className="text-sm text-slate-400">
                      Diff {formatMoney(rec.differenceMinor)} · {rec.matchedCount} matched
                    </p>
                  </div>
                  <StatusBadge status={rec.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
