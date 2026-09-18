import type { Metadata } from 'next';
import { Permission, ReportKind, reportKindSchema } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { Card, EmptyState, inputClass, PageHeader, SectionHeading } from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Financial reports' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; from?: string; to?: string; asOf?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.REPORT_READ) && !can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view reports." />;
  }

  const params = await searchParams;
  const kindParsed = params.kind ? reportKindSchema.safeParse(params.kind.toUpperCase()) : null;
  const kind = kindParsed?.success ? kindParsed.data : ReportKind.TRIAL_BALANCE;
  const from = params.from?.trim() || undefined;
  const to = params.to?.trim() || undefined;
  const asOf = params.asOf?.trim() || undefined;

  const report = await api.getAccountingReport(token, { kind, from, to, asOf });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial reports"
        description="Trial balance, income statement, balance sheet, budget vs actual, giving, project cost, and cash activity."
      />

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="kind" className="text-xs uppercase tracking-wide text-slate-500">
              Report
            </label>
            <select id="kind" name="kind" defaultValue={kind} className={inputClass}>
              {Object.values(ReportKind).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="from" className="text-xs uppercase tracking-wide text-slate-500">
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={from ?? ''} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="to" className="text-xs uppercase tracking-wide text-slate-500">
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={to ?? ''} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="asOf" className="text-xs uppercase tracking-wide text-slate-500">
              As of
            </label>
            <input id="asOf" name="asOf" type="date" defaultValue={asOf ?? ''} className={inputClass} />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Run
          </button>
        </form>
      </Card>

      <Card>
        <SectionHeading
          title={report.title}
          description={`${report.from ? formatDate(report.from) : ''}${report.to ? ` – ${formatDate(report.to)}` : ''}${report.asOf ? ` as of ${formatDate(report.asOf)}` : ''}`}
        />
        <p className="mt-2 text-sm text-slate-400">Net {formatMoney(report.netMinor, report.currency)}</p>
        <div className="mt-6 space-y-8">
          {report.sections.map((section) => (
            <div key={section.name}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{section.name}</h3>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-2">Account</th>
                    <th className="pb-2 text-right">Debit</th>
                    <th className="pb-2 text-right">Credit</th>
                    <th className="pb-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {section.lines.map((line, index) => (
                    <tr key={`${line.accountId ?? line.accountName}-${index}`}>
                      <td className="py-2">
                        {line.accountCode ? `${line.accountCode} ` : ''}
                        {line.accountName}
                      </td>
                      <td className="py-2 text-right">{line.debitMinor ? formatMoney(line.debitMinor, report.currency) : ''}</td>
                      <td className="py-2 text-right">{line.creditMinor ? formatMoney(line.creditMinor, report.currency) : ''}</td>
                      <td className="py-2 text-right">{formatMoney(line.balanceMinor, report.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-3 font-medium">Total</td>
                    <td />
                    <td />
                    <td className="pt-3 text-right font-medium">{formatMoney(section.totalMinor, report.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
