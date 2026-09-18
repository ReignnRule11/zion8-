import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { PayrollEmployeeForm, PayrollRunForm } from '@/components/accounting/payroll-forms';
import {
  Card,
  EmptyState,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Payroll' };

export default async function PayrollPage() {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view payroll." />;
  }

  const canManage = can(me, Permission.ACCOUNTING_MANAGE);
  const [employees, runs, accounts] = await Promise.all([
    api.listPayrollEmployees(token, { limit: 50, offset: 0 }),
    api.listPayrollRuns(token, { limit: 25, offset: 0 }),
    canManage ? api.listAccounts(token, { limit: 200, offset: 0 }) : Promise.resolve({ items: [] as Awaited<ReturnType<typeof api.listAccounts>>['items'] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Staff pay runs. Tax is a deterministic 10% withholding until a tax engine exists."
      />

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeading title="Add employee" />
            <div className="mt-4">
              <PayrollEmployeeForm accounts={accounts.items} />
            </div>
          </Card>
          <Card>
            <SectionHeading title="New payroll run" />
            <div className="mt-4">
              <PayrollRunForm />
            </div>
          </Card>
        </div>
      ) : null}

      <Card>
        <SectionHeading title="Employees" />
        {employees.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No employees yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {employees.items.map((employee) => (
              <li key={employee.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{employee.displayName}</p>
                  <p className="text-sm text-slate-400">
                    {employee.title ?? 'Staff'} · {humanize(employee.payFrequency)} · {formatMoney(employee.grossMinor)}
                  </p>
                </div>
                <StatusBadge status={employee.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {runs.items.length === 0 ? (
        <EmptyState message="No payroll runs yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {runs.items.map((run) => (
            <li key={run.id}>
              <Link
                href={`/accounting/payroll/${run.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div>
                  <p className="font-medium">
                    {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
                  </p>
                  <p className="text-sm text-slate-400">Pay on {formatDate(run.payOn)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">{formatMoney(run.netMinor)}</span>
                  <StatusBadge status={run.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
