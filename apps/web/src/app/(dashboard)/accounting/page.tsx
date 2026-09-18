import type { Metadata } from 'next';
import {
  AccountStatus,
  AccountType,
  FiscalPeriodStatus,
  Permission,
  accountStatusSchema,
  accountTypeSchema,
  fiscalPeriodStatusSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { closePeriodAction } from './actions';
import { AccountForm, PeriodForm } from '@/components/accounting/ledger-forms';
import { ConfirmActionButton } from '@/components/membership/confirm-action-button';
import {
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Accounting' };

const PAGE_SIZE = 50;

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    type?: string;
    status?: string;
    periodStatus?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view accounting." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const type = params.type ? accountTypeSchema.safeParse(params.type.toUpperCase()) : null;
  const status = params.status ? accountStatusSchema.safeParse(params.status.toUpperCase()) : null;
  const periodStatus = params.periodStatus
    ? fiscalPeriodStatusSchema.safeParse(params.periodStatus.toUpperCase())
    : null;
  const canManage = can(me, Permission.ACCOUNTING_MANAGE);
  const canClose = can(me, Permission.ACCOUNTING_CLOSE_PERIOD);

  const [accounts, periods] = await Promise.all([
    api.listAccounts(token, {
      limit,
      offset,
      search,
      type: type?.success ? type.data : undefined,
      status: status?.success ? status.data : undefined,
    }),
    api.listPeriods(token, {
      limit: 20,
      offset: 0,
      status: periodStatus?.success ? periodStatus.data : undefined,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="General ledger"
        description="Chart of accounts and fiscal periods. The default chart is seeded on first use."
      />

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeading title="New account" />
            <div className="mt-4">
              <AccountForm accounts={accounts.items} />
            </div>
          </Card>
          <Card>
            <SectionHeading title="New fiscal period" />
            <div className="mt-4">
              <PeriodForm />
            </div>
          </Card>
        </div>
      ) : null}

      <Card>
        <SectionHeading title="Fiscal periods" />
        {periods.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No fiscal periods yet." hint="Create a period before posting journals." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {periods.items.map((period) => (
              <li key={period.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{period.name}</p>
                  <p className="text-sm text-slate-400">
                    {formatDate(period.startsOn)} – {formatDate(period.endsOn)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={period.status} />
                  {canClose && period.status === FiscalPeriodStatus.OPEN ? (
                    <ConfirmActionButton
                      action={closePeriodAction}
                      fields={{ periodId: period.id }}
                      pendingLabel="Closing"
                      confirmMessage="Close this period? Journals dated inside it can no longer be posted."
                      variant="secondary"
                    >
                      Close
                    </ConfirmActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <label htmlFor="search" className="text-xs uppercase tracking-wide text-slate-500">
              Search
            </label>
            <input
              id="search"
              name="search"
              defaultValue={search ?? ''}
              placeholder="Code or name"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="type" className="text-xs uppercase tracking-wide text-slate-500">
              Type
            </label>
            <select id="type" name="type" defaultValue={type?.success ? type.data : ''} className={inputClass}>
              <option value="">Any type</option>
              {Object.values(AccountType).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select id="status" name="status" defaultValue={status?.success ? status.data : ''} className={inputClass}>
              <option value="">Any status</option>
              {Object.values(AccountStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Apply filters
          </button>
        </form>
      </Card>

      {accounts.items.length === 0 ? (
        <EmptyState message="No accounts yet." hint="The default chart seeds when you create the first account." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {accounts.items.map((account) => (
            <li key={account.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {account.code} {account.name}
                </p>
                <p className="text-sm text-slate-400">
                  {humanize(account.type)} · {humanize(account.normalBalance)}
                  {account.isPostable ? '' : ' · header'}
                </p>
              </div>
              <StatusBadge status={account.status} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/accounting"
        limit={limit}
        offset={offset}
        total={accounts.total}
        filters={{
          search,
          type: type?.success ? type.data : undefined,
          status: status?.success ? status.data : undefined,
        }}
      />
    </div>
  );
}
