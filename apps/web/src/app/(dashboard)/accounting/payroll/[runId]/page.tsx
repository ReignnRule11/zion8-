import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PayrollRunStatus, Permission } from '@zion8/contracts';
import { ApiRequestError, api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { approvePayrollRunAction, postPayrollRunAction } from '../../actions';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import { Card, DefinitionList, EmptyState, SectionHeading, StatusBadge } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Payroll run' };

export default async function PayrollRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { token, me } = await loadPrincipal();
  const { runId } = await params;
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view payroll." />;
  }

  let run;
  try {
    run = await api.getPayrollRun(token, runId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'PAYROLL_RUN_NOT_FOUND') notFound();
    throw error;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);

  return (
    <div className="space-y-6">
      <Link href="/accounting/payroll" className="text-sm text-slate-400 transition hover:text-slate-200">
        Back to payroll
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Pay on {formatDate(run.payOn)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={run.status} />
          {canManage && run.status === PayrollRunStatus.DRAFT ? (
            <ConfirmActionButton
              action={approvePayrollRunAction}
              fields={{ runId: run.id }}
              pendingLabel="Approving"
              variant="secondary"
            >
              Approve
            </ConfirmActionButton>
          ) : null}
          {canManage && run.status === PayrollRunStatus.APPROVED ? (
            <ConfirmActionButton
              action={postPayrollRunAction}
              fields={{ runId: run.id }}
              pendingLabel="Posting"
              confirmMessage="Post this payroll run to the ledger?"
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
            { term: 'Gross', value: formatMoney(run.grossMinor) },
            { term: 'Tax (10%)', value: formatMoney(run.taxMinor) },
            { term: 'Net', value: formatMoney(run.netMinor) },
            { term: 'Memo', value: run.memo ?? '—' },
            {
              term: 'Journal',
              value: run.journalId ? (
                <Link href={`/accounting/journals/${run.journalId}`} className="text-zion-200 hover:underline">
                  View journal
                </Link>
              ) : (
                '—'
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <SectionHeading title="Items" />
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2">Employee</th>
              <th className="pb-2 text-right">Gross</th>
              <th className="pb-2 text-right">Tax</th>
              <th className="pb-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {run.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.employeeName}</td>
                <td className="py-2 text-right">{formatMoney(item.grossMinor)}</td>
                <td className="py-2 text-right">{formatMoney(item.taxMinor)}</td>
                <td className="py-2 text-right">{formatMoney(item.netMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
