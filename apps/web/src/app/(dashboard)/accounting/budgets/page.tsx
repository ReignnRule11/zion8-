import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { BudgetForm } from '@/components/accounting/budget-forms';
import { Card, EmptyState, PageHeader, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Budgets' };

export default async function BudgetsPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view budgets." />;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);
  const [budgets, accounts] = await Promise.all([
    api.listBudgets(token, { limit: 50, offset: 0 }),
    canManage ? api.listAccounts(token, { limit: 200, offset: 0 }) : Promise.resolve({ items: [] as Awaited<ReturnType<typeof api.listAccounts>>['items'] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Budgets" description="Named envelopes with lines against GL accounts. Activate to lock the plan." />

      {canManage ? (
        <Card>
          <SectionHeading title="New budget" />
          <div className="mt-4">
            <BudgetForm accounts={accounts.items} />
          </div>
        </Card>
      ) : null}

      {budgets.items.length === 0 ? (
        <EmptyState message="No budgets yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {budgets.items.map((budget) => (
            <li key={budget.id}>
              <Link
                href={`/accounting/budgets/${budget.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div>
                  <p className="font-medium">{budget.name}</p>
                  <p className="text-sm text-slate-400">
                    {formatDate(budget.startsOn)} – {formatDate(budget.endsOn)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">{formatMoney(budget.totalMinor)}</span>
                  <StatusBadge status={budget.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
