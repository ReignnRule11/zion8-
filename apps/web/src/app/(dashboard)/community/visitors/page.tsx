import type { Metadata } from 'next';
import Link from 'next/link';
import { Permission, VisitorStatus, visitorStatusSchema } from '@zion8/contracts';
import { api } from '@/lib/api-client';
import { formatDate, humanize } from '@/lib/format';
import { can, loadPrincipal } from '@/lib/principal';
import { createVisitorAction } from '../actions';
import {
  Badge,
  Card,
  EmptyState,
  inputClass,
  Pagination,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/membership/ui';
import { VisitorForm } from '@/components/membership/visitor-form';

export const metadata: Metadata = { title: 'Visitors' };

const PAGE_SIZE = 25;

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; offset?: string; limit?: string }>;
}) {
  const { token, me } = await loadPrincipal();
  if (!can(me, Permission.VISITOR_READ)) {
    return <EmptyState message="You do not have permission to view visitors." />;
  }

  const params = await searchParams;
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const search = params.search?.trim() || undefined;
  const status = params.status ? visitorStatusSchema.safeParse(params.status.toUpperCase()) : null;

  const page = await api.listVisitors(token, {
    limit,
    offset,
    search,
    status: status?.success ? status.data : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="The pre-membership pipeline: who came, who returned, and who converted."
      />

      {can(me, Permission.VISITOR_CREATE) ? (
        <Card>
          <SectionHeading title="Add a visitor" />
          <div className="mt-4">
            <VisitorForm />
          </div>
        </Card>
      ) : null}

      <Card className="!p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <label htmlFor="search" className="text-xs uppercase tracking-wide text-slate-500">
              Search
            </label>
            <input
              id="search"
              name="search"
              defaultValue={search ?? ''}
              placeholder="Name or email"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status?.success ? status.data : ''}
              className={inputClass}
            >
              <option value="">Any status</option>
              {Object.values(VisitorStatus).map((value) => (
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

      {page.items.length === 0 ? (
        <EmptyState message="No visitors match these filters." />
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.items.map((visitor) => (
            <li key={visitor.id}>
              <Link
                href={`/community/visitors/${visitor.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{visitor.fullName}</p>
                  <p className="truncate text-sm text-slate-400">
                    {[visitor.email, visitor.phone].filter(Boolean).join(' · ') ||
                      'No contact details'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden text-right text-xs text-slate-400 sm:block">
                    <p>{visitor.visitCount} visits</p>
                    <p>Last {formatDate(visitor.lastVisitAt)}</p>
                  </div>
                  <Badge>{humanize(visitor.source)}</Badge>
                  <StatusBadge status={visitor.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/community/visitors"
        limit={limit}
        offset={offset}
        total={page.total}
        filters={{ search, status: status?.success ? status.data : undefined }}
      />
    </div>
  );
}
