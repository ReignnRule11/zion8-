import type { Metadata } from 'next';
import Link from 'next/link';
import { JournalSource, JournalStatus, Permission, journalSourceSchema, journalStatusSchema } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import {
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  StatusBadge,
} from '@/components/membership/ui';

export const metadata: Metadata = { title: 'Journals' };

const PAGE_SIZE = 25;

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    source?: string;
    from?: string;
    to?: string;
    offset?: string;
    limit?: string;
  }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.ACCOUNTING_READ)) {
    return <EmptyState message="You do not have permission to view journals." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const from = params.from?.trim() || undefined;
  const to = params.to?.trim() || undefined;
  const status = params.status ? journalStatusSchema.safeParse(params.status.toUpperCase()) : null;
  const source = params.source ? journalSourceSchema.safeParse(params.source.toUpperCase()) : null;
  const canManage = can(me, Permission.ACCOUNTING_MANAGE);

  const page = await api.listJournals(token, {
    limit,
    offset,
    search,
    from,
    to,
    status: status?.success ? status.data : undefined,
    source: source?.success ? source.data : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journals"
        description="Double-entry books. Drafts can be posted or voided; posted journals are immutable."
        action={
          canManage ? (
            <Link
              href="/accounting/journals/new"
              className="bg-zion-600 hover:bg-zion-500 rounded-lg px-4 py-2 text-sm font-medium text-white transition"
            >
              New journal
            </Link>
          ) : undefined
        }
      />

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
              {Object.values(JournalStatus).map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="source" className="text-xs uppercase tracking-wide text-slate-500">
              Source
            </label>
            <select id="source" name="source" defaultValue={source?.success ? source.data : ''} className={inputClass}>
              <option value="">Any</option>
              {Object.values(JournalSource).map((value) => (
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

      {page.items.length === 0 ? (
        <EmptyState message="No journals yet." hint="Record a gift or write a manual entry." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.items.map((journal) => (
            <li key={journal.id}>
              <Link
                href={`/accounting/journals/${journal.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    #{journal.number} {journal.memo}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatDate(journal.occurredOn)} · {humanize(journal.source)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">{formatMoney(journal.debitMinor)}</span>
                  <StatusBadge status={journal.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/accounting/journals"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{
          search,
          from,
          to,
          status: status?.success ? status.data : undefined,
          source: source?.success ? source.data : undefined,
        }}
      />
    </div>
  );
}
