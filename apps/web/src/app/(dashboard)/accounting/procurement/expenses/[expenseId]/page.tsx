import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExpenseStatus, Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { postExpenseAction, submitExpenseAction } from '../../../actions';
import { ExpenseDecisionForm } from '@/components/accounting/procurement-forms';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Expense' };

export default async function ExpensePage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { token, me } = await loadPrincipal();
  const { expenseId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view procurement." />;
  }

  let expense;
  try {
    expense = await api.getExpense(token, expenseId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'EXPENSE_NOT_FOUND') notFound();
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
          <h1 className="text-2xl font-semibold tracking-tight">{expense.memo}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {expense.submitterName ?? 'Staff'} · {formatDate(expense.incurredOn)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={expense.status} />
          {canManage && expense.status === ExpenseStatus.DRAFT ? (
            <ConfirmActionButton
              action={submitExpenseAction}
              fields={{ expenseId: expense.id }}
              pendingLabel="Submitting"
              variant="secondary"
            >
              Submit
            </ConfirmActionButton>
          ) : null}
          {canManage && expense.status === ExpenseStatus.APPROVED ? (
            <ConfirmActionButton
              action={postExpenseAction}
              fields={{ expenseId: expense.id }}
              pendingLabel="Posting"
              confirmMessage="Post this expense to the ledger?"
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
            { term: 'Amount', value: formatMoney(expense.amountMinor) },
            { term: 'Merchant', value: expense.merchant ?? '—' },
            { term: 'Decision note', value: expense.decisionNote ?? '—' },
            {
              term: 'Journal',
              value: expense.journalId ? (
                <Link href={`/accounting/journals/${expense.journalId}`} className="text-zion-200 hover:underline">
                  View journal
                </Link>
              ) : (
                '—'
              ),
            },
          ]}
        />
      </Card>

      {canManage && expense.status === ExpenseStatus.SUBMITTED ? (
        <Card>
          <SectionHeading title="Decision" />
          <div className="mt-4">
            <ExpenseDecisionForm expenseId={expense.id} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
