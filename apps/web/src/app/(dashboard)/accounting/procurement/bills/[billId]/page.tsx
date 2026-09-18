import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BillStatus, Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { approveBillAction, postBillAction } from '../../../actions';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { Card, DefinitionList, EmptyState, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Bill' };

export default async function BillPage({ params }: { params: Promise<{ billId: string }> }) {
  const { token, me } = await loadPrincipal();
  const { billId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view procurement." />;
  }

  let bill;
  try {
    bill = await api.getBill(token, billId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'BILL_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);

  return (
    <div className="space-y-6">
      <Link href="/accounting/procurement" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to procurement
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            BILL-{bill.number} {bill.vendorName}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Billed {formatDate(bill.billedOn)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={bill.status} />
          {canManage && bill.status === BillStatus.DRAFT ? (
            <ConfirmActionButton
              action={approveBillAction}
              fields={{ billId: bill.id }}
              pendingLabel="Approving"
              variant="secondary"
            >
              Approve
            </ConfirmActionButton>
          ) : null}
          {canManage && bill.status === BillStatus.APPROVED ? (
            <ConfirmActionButton
              action={postBillAction}
              fields={{ billId: bill.id }}
              pendingLabel="Posting"
              confirmMessage="Post this bill to the ledger?"
              variant="primary"
            >
              Post
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      <Card>
        <DefinitionList
          items={[
            { term: 'Amount', value: formatMoney(bill.amountMinor) },
            { term: 'Due', value: formatDate(bill.dueOn) },
            { term: 'Memo', value: bill.memo ?? '—' },
            {
              term: 'Journal',
              value: bill.journalId ? (
                <Link href={`/accounting/journals/${bill.journalId}`} className="text-zion-200 hover:underline">
                  View journal
                </Link>
              ) : (
                '—'
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
