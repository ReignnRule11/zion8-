import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Permission, ReconciliationStatus } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { completeReconciliationAction } from '../../../actions';
import { MatchReconciliationForm } from '@/components/accounting/recon-forms';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Reconciliation' };

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ reconciliationId: string }>;
}) {
  const { token, me } = await loadPrincipal();
  const { reconciliationId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view bank reconciliation." />;
  }

  let rec;
  try {
    rec = await api.getReconciliation(token, reconciliationId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'RECONCILIATION_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);

  return (
    <div className="space-y-6">
      <Link
        href={`/accounting/recon/${rec.bankAccountId}`}
        className="text-sm text-slate-400 transition hover:text-slate-200"
      >
        Back to {rec.bankAccountName}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statement {formatDate(rec.statementOn)}</h1>
          <p className="mt-1 text-sm text-slate-400">{rec.bankAccountName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={rec.status} />
          {canManage && rec.status === ReconciliationStatus.OPEN ? (
            <ConfirmActionButton
              action={completeReconciliationAction}
              fields={{ reconciliationId: rec.id }}
              pendingLabel="Completing"
              confirmMessage="Complete only if the difference is zero."
              variant="primary"
            >
              Complete
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      <Card>
        <DefinitionList
          items={[
            { term: 'Statement balance', value: formatMoney(rec.statementBalanceMinor) },
            { term: 'Book balance', value: formatMoney(rec.bookBalanceMinor) },
            { term: 'Difference', value: formatMoney(rec.differenceMinor) },
            { term: 'Matched', value: String(rec.matchedCount) },
            { term: 'Unmatched', value: String(rec.unmatchedCount) },
          ]}
        />
      </Card>

      {canManage && rec.status === ReconciliationStatus.OPEN ? (
        <Card>
          <SectionHeading title="Match a line" description="Pair a bank transaction with a posted journal." />
          <div className="mt-4">
            <MatchReconciliationForm reconciliationId={rec.id} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
