import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ContributionStatus,
  Permission,
  contributionStatusSchema,
} from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { ContributionForm, FundForm } from '@/components/accounting/giving-forms';
import {
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Giving' };

const PAGE_SIZE = 25;

export default async function GivingPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    from?: string;
    to?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.GIVING_READ) && !can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view giving." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const from = params.from?.trim() || undefined;
  const to = params.to?.trim() || undefined;
  const status = params.status ? contributionStatusSchema.safeParse(params.status.toUpperCase()) : null;
  const canRecord = can(me, Permission.GIVING_RECORD);

  const [funds, contributions, accounts] = await Promise.all([
    api.listFunds(token, { limit: 100, offset: 0 }),
    api.listContributions(token, {
      limit,
      offset,
      search,
      from,
      to,
      status: status?.success ? status.data : undefined,
    }),
    canRecord ? api.listAccounts(token, { limit: 200, offset: 0 }) : Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giving"
        description="Funds and contributions. Recording a gift posts cash and revenue in the same transaction."
      />

      {canRecord ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeading title="New fund" />
            <div className="mt-4">
              <FundForm accounts={accounts.items} />
            </div>
          </Card>
          <Card>
            <SectionHeading title="Record a contribution" />
            <div className="mt-4">
              {funds.items.length === 0 ? (
                <EmptyState message="Create a fund first." />
              ) : (
                <ContributionForm funds={funds.items} />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      <Card>
        <SectionHeading title="Funds" />
        {funds.items.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No funds yet." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {funds.items.map((fund) => (
              <li key={fund.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{fund.name}</p>
                  <p className="text-sm text-slate-400">{fund.restricted ? 'Restricted' : 'Unrestricted'}</p>
                </div>
                <StatusBadge status={fund.status} />
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
            <input id="search" name="search" defaultValue={search ?? ''} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select id="status" name="status" defaultValue={status?.success ? status.data : ''} className={inputClass}>
              <option value="">Any</option>
              {Object.values(ContributionStatus).map((value) => (
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
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Apply
          </button>
        </form>
      </Card>

      {contributions.items.length === 0 ? (
        <EmptyState message="No contributions yet." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {contributions.items.map((gift) => (
            <li key={gift.id}>
              <Link
                href={`/accounting/giving/${gift.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{gift.donorName ?? 'Anonymous'}</p>
                  <p className="text-sm text-slate-400">
                    {gift.fundName} · {formatDate(gift.receivedOn)} · {humanize(gift.method)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">{formatMoney(gift.amountMinor, gift.currency)}</span>
                  <StatusBadge status={gift.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/accounting/giving"
        limit={limit}
        offset={offset}
        total={contributions.total}
        filters={{
          search,
          from,
          to,
          status: status?.success ? status.data : undefined,
        }}
      />
    </div>
  );
}
