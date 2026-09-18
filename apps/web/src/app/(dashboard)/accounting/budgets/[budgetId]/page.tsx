import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BudgetStatus, Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { activateBudgetAction } from '../../actions';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Budget' };

export default async function BudgetDetailPage({ params }: { params: Promise<{ budgetId: string }> }) {
  const { token, me } = await loadPrincipal();
  const { budgetId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view budgets." />;
  }

  let budget;
  try {
    budget = await api.getBudget(token, budgetId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'BUDGET_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);

  return (
    <div className="space-y-6">
      <Link href="/accounting/budgets" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to budgets
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{budget.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {formatDate(budget.startsOn)} – {formatDate(budget.endsOn)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={budget.status} />
          {canManage && budget.status === BudgetStatus.DRAFT ? (
            <ConfirmActionButton
              action={activateBudgetAction}
              fields={{ budgetId: budget.id }}
              pendingLabel="Activating"
              variant="primary"
            >
              Activate
            </ConfirmActionButton>
          ) : null}
        </div>
      </header>

      <Card>
        <DefinitionList
          items={[
            { term: 'Budgeted', value: formatMoney(budget.totalMinor) },
            { term: 'Actual', value: formatMoney(budget.actualMinor) },
            { term: 'Notes', value: budget.notes ?? '—' },
          ]}
        />
      </Card>

      <Card>
        <SectionHeading title="Lines" />
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2">Account</th>
              <th className="pb-2 text-right">Budget</th>
              <th className="pb-2 text-right">Actual</th>
              <th className="pb-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {budget.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2">
                  {line.accountCode} {line.accountName}
                </td>
                <td className="py-2 text-right">{formatMoney(line.amountMinor)}</td>
                <td className="py-2 text-right">{formatMoney(line.actualMinor)}</td>
                <td className="py-2 text-right">{formatMoney(line.varianceMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
